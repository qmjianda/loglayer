## Context

当前后端 `open_file` 每次打开文件都启动 `IndexingWorker` 扫描字节偏移；大文件二次打开仍重扫（数秒至十余秒）。存在 `BaseStorageProvider`（storage.py）雏形（同步 open/get_mmap），但缺少：完整数据源抽象（read_lines/get_line_offsets）、SQLite 缓存、LRU 淘汰、超大日志压缩存储。ps 已完整验证 `ILogStreamProvider` + `SqliteMetadataCache` 方案。前端 `useBridge` 依赖 `partial` 信号处理 preview 两阶段索引。

## Goals / Non-Goals

**Goals:**
- 完整 `ILogStreamProvider` 抽象，替换 `BaseStorageProvider`
- SQLite 缓存：偏移分块压缩存储，前8K+后8K+size 哈希校验
- LRU 淘汰：字节上限软目标 + 最少 1 文件硬下限，当前编辑豁免
- 移除 preview 两阶段，改单阶段完整索引
- `files[]` 永不删除 + `wasOpen` 标记控制自动恢复

**Non-Goals:**
- 不迁移搜索（search_nearest/exact_index）进 provider——搜索集成作为后续独立变更
- 不引入远程 provider（S3/SSH）实现，仅预留接口
- 不改动 dockview 分屏（独立变更）

## Decisions

### Decision 1: 完整 VFS 抽象替换 BaseStorageProvider

用 ps 风格 `ILogStreamProvider`（open/close/read_lines/get_line_offsets/get_raw_bytes）替换 `BaseStorageProvider`。`LocalFileProvider` 实现 mmap。现有 `bridge.py` 的 `_sessions` 保留，但文件访问走 provider。备选（保留现有 provider 只加缓存）被否——用户明确要求完整抽象，保持可扩展性。

### Decision 2: 偏移 BLOB 分块 + zlib 压缩

千万行文件的 `array.array("Q")` 约 8 字节/行（2290 万行 ≈ 183MB）。整块 BLOB 过大。决策：按固定行数（如 100 万行/块）分块，每块 zlib 压缩后存 SQLite（BLOB）。读取时逐块解压拼接。备选（整块压缩）被否——单块过大，内存峰值高；分块可按需加载、失败重试粒度小。

### Decision 3: 缓存 LRU —— 字节上限软目标 + 最少 1 文件硬下限

矛盾：单文件可超字节上限（否则"最少 1 文件"与"字节上限"冲突）。决策：
- 优先级：LRU（最近使用优先保留）
- 软上限：字节超过配置时，从最久未用开始淘汰
- 硬下限：至少保留 1 个文件，永不淘汰到 0
- 豁免：当前正在编辑的文件不参与淘汰
设置项 `AppSettings.cacheSizeMB`（默认 2048）。

### Decision 4: 移除 preview 两阶段索引

`IndexingWorker` 去掉 preview/partial 两阶段，改为单阶段完整扫描。`open_file` 同步或异步完成后一次性 `fileLoaded`。前端 `useBridge` 的 `partial` 分支删除。首次打开完整等待（用户已确认可接受），命中缓存秒开。备选（保留 preview）被否——preview 收益有限，且与缓存架构（需要完整偏移才能命中）冲突。

### Decision 5: files[] 永不删除 + wasOpen 标记

`WorkspaceConfig.files[]` 作为文件完整历史，关闭文件不删除条目，仅置 `wasOpen=false`。保存配置时 `wasOpen = 文件当前是否在编辑区`。加载配置时仅自动打开 `wasOpen=true` 的文件；全部历史文件进入文件列表。

### Decision 6: 缓存与 session 生命周期配合

`open_file` 流程：查缓存（命中 → 反序列化偏移 → 直接建 session）→ 未命中 → 单阶段索引 → 写缓存。session 仍由 `_sessions` 管理（保留现有内存缓存/rendering_cache 语义），SQLite 仅持久化偏移。关闭文件不删缓存（LRU 决定）。

## Risks / Trade-offs

- [分块压缩引入编解码开销] → 首次读缓存比纯内存慢，但相比重扫索引仍快几个数量级；命中后偏移驻留内存
- [mtime/hash 校验误判] → 用 ps 前8K+后8K+size 哈希，兼顾速度与敏感度；误判后果只是重新索引（安全降级）
- [单阶段索引首次打开更慢] → 用户已确认可接受"首次打开稍等"；命中缓存秒开补偿
- [wasOpen 语义与现有加载冲突] → 恢复逻辑仅自动打开 wasOpen=true，历史文件进列表不打开，避免二次进入目录文件全开
- [缓存膨胀] → LRU 自动淘汰 + 设置项可调 + 清空缓存入口

## Migration Plan

1. 新增 `loglayer/vfs.py`（ILogStreamProvider + LocalFileProvider）、`loglayer/metadata_cache.py`（SqliteMetadataCache + 分块压缩 + LRU）
2. `bridge.py`：`open_file` 接入缓存查/存，改用 provider；`IndexingWorker` 改单阶段
3. 前端 `useBridge`/`App.tsx`：移除 partial 分支
4. `useSettings.tsx`：新增 cacheSizeMB 设置；SettingsPanel 增加配置 UI
5. `useWorkspaceConfig.ts` + 后端：wasOpen 持久化与恢复
6. 全量回归：首开/二开/文件变更/清空缓存/多文件 LRU

## Open Questions

- 分块阈值（块行数）默认值？建议 100 万行/块，可在实现中基准测试调整
- `cacheSizeMB` 默认值？建议 2048MB，覆盖约 10 个典型大文件
- 清空缓存 UI 放设置面板何处？（待 SettingsPanel 现状确认）
