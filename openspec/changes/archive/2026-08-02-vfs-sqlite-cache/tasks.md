## 1. VFS 抽象

- [x] 1.1 新增 `backend/loglayer/vfs.py`：定义 `ILogStreamProvider`（open/close/read_lines/get_line_offsets/get_raw_bytes）
- [x] 1.2 实现 `LocalFileProvider`（mmap）：open、read_lines、get_line_offsets、get_raw_bytes
- [x] 1.3 迁移 `bridge.py` 文件访问走 provider；`BaseStorageProvider` 标记废弃/兼容

## 2. SQLite 缓存

- [x] 2.1 新增 `backend/loglayer/metadata_cache.py`：`SqliteMetadataCache`（file_path PK + hash + 分块压缩偏移 BLOB）
- [x] 2.2 实现前8K+后8K+size 哈希校验；文件变更自动 invalidate
- [x] 2.3 实现偏移分块序列化 + zlib 压缩/解压
- [x] 2.4 `open_file` 接入缓存：命中→反序列化偏移直接建 session；未命中→索引后写缓存

## 3. 单阶段索引（移除 preview）

- [x] 3.1 `IndexingWorker` 移除 preview/partial 两阶段，改单阶段完整索引
- [x] 3.2 `open_file` 完成后一次性 `fileLoaded`（无 partial）
- [x] 3.3 前端 `useBridge`/`App.tsx` 移除 partial 分支处理

## 4. LRU 缓存淘汰

- [x] 4.1 实现 LRU 淘汰：最近使用优先，字节超上限从最旧淘汰
- [x] 4.2 硬下限：至少保留 1 个文件（单文件超上限仍缓存）
- [x] 4.3 当前编辑文件豁免淘汰
- [x] 4.4 `AppSettings.cacheSizeMB` 设置项 + SettingsPanel 配置 UI + 清空缓存入口

## 5. 文件历史持久化（wasOpen）

- [x] 5.1 `WorkspaceConfig.files[]` 增加 `wasOpen` 字段（默认 true）
- [x] 5.2 保存配置时：`wasOpen = 文件当前是否在编辑区`；关闭文件不删除条目仅置 false
- [x] 5.3 加载配置时：仅自动打开 `wasOpen=true` 的文件；全部历史文件进入文件列表
- [x] 5.4 后端/前端同步 wasOpen 持久化与恢复逻辑

## 6. 验证

- [x] 6.1 `npx tsc --noEmit` 通过（项目未配置 vitest，tsc 为前端唯一门禁）
- [x] 6.2 后端 pytest：新增 `tests/unit/test_vfs.py` + `tests/unit/test_metadata_cache.py` + `tests/unit/test_cache_workspace.py`（共 35 用例），现有测试无回归（49 passed）
- [x] 6.3 手测 + e2e 固化：
  - 手测已确认：首开完整等待、二开秒开、文件变更重索引、清空缓存、LRU 多文件淘汰、wasOpen 恢复、关闭/二次打开不再卡 loading、侧栏 X 关文件移入历史栏
  - 新增 `tests/e2e/test_cache_reopen_ui.py`（2 用例）覆盖：关闭后二次打开显示行数、关闭移入历史文件栏
  - e2e conftest 改为启动前强制杀掉既有前后端进程（`kill_existing_servers`），确保测试不受手动启动的旧实例干扰
