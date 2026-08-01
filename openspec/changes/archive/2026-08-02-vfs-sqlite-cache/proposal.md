## Why

当前后端 `open_file` 每次打开大日志文件都重新扫描字节偏移（`IndexingWorker`），二次打开同一文件耗时数秒至十余秒。loglayer_ps 验证了完整 VFS 抽象 + SQLite 元数据缓存方案：偏移索引持久化到磁盘，二次打开命中缓存秒开。当前项目已有 `BaseStorageProvider` 雏形，但缺少完整数据源抽象、SQLite 缓存、LRU 淘汰与超大日志的压缩存储。目标：完整升级 VFS，实现"大日志二次打开秒开 + 索引跨会话持久 + 可配置缓存"。

## What Changes

- **BREAKING** 用 ps 风格 `ILogStreamProvider` 完整抽象替换现有 `BaseStorageProvider`，`LocalFileProvider` 负责 mmap 打开、`read_lines`、`get_line_offsets`
- 引入 `SqliteMetadataCache`（`.loglayer/cache.db`）：缓存行偏移索引，文件哈希 = 前 8KB + 后 8KB + size
- 偏移索引**分块 + zlib 压缩**存储为 BLOB，适配超大日志（千万行级）
- **缓存 LRU 淘汰**：字节上限为软目标，硬性保证至少缓存 1 个文件；当前正在编辑的文件豁免淘汰
- 缓存大小可在设置中配置（`AppSettings.cacheSizeMB`，默认值待定），最少缓存 1 个文件
- **移除 IndexingWorker 的 preview 两阶段**，改为单阶段完整索引（首次打开完整等待，命中缓存秒开）
- **BREAKING** 前端移除 `partial` 分支处理，`fileLoaded` 只发一次完整信号
- `WorkspaceConfig.files[]` 增加 `wasOpen` 标记：用户主动关闭面板/文件时置 `false`；`files[]` 永不删除（完整历史记录），二次进入项目只自动恢复 `wasOpen=true` 的文件

## Capabilities

### New Capabilities
- `vfs-provider`: 完整 `ILogStreamProvider` 数据源抽象，`LocalFileProvider` 实现 mmap 打开、行读取、偏移获取；打开文件改为单阶段完整索引（移除 preview 两阶段）
- `index-metadata-cache`: SQLite 偏移缓存，分块压缩存储，前8K+后8K+size 哈希校验，文件变更自动失效
- `cache-lru-eviction`: 缓存 LRU 淘汰，字节上限软目标 + 最少 1 文件硬下限，当前编辑文件豁免
- `file-history-persistence`: `files[]` 完整历史（永不删除）+ `wasOpen` 标记控制自动恢复

### Modified Capabilities
<!-- 若修改现有行为 -->

## Impact

- `backend/loglayer/vfs.py`: 新增 `ILogStreamProvider` + `LocalFileProvider`
- `backend/loglayer/metadata_cache.py`: 新增 `SqliteMetadataCache`（分块压缩 + LRU）
- `backend/bridge.py`: `open_file` 接入缓存查/存；`open_file` 改用 provider 抽象；移除 preview
- `backend/loglayer/storage.py`: `BaseStorageProvider` 迁移/兼容
- `backend/main.py`: 设置项透传（缓存大小）
- `frontend/src/hooks/useBridge.ts` / `App.tsx`: 移除 `partial` 分支
- `frontend/src/hooks/useSettings.tsx`: 新增 `cacheSizeMB` 设置
- `frontend/src/hooks/useWorkspaceConfig.ts`: 持久化 `wasOpen`；恢复时仅自动打开 `wasOpen=true`
