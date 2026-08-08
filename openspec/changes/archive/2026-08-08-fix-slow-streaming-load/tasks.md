# Tasks: fix-slow-streaming-load

## 1. 后端打点（backend/bridge.py）

- [x] 1.1 在 bridge.py 模块级添加 `TIMING_ENABLED = os.environ.get("LOGLAYER_TIMING") == "1"` 与 `timing()` 辅助函数（`[Timing] <stage> wall=<epoch_ms> file=<file_id> <duration_ms>ms <extra>`，关闭时立即 return 零开销）
- [x] 1.2 `open_file()`：入口 `open_file.entry`；缓存查找后 `open_file.cache_lookup`（耗时 + hit 标志）；命中分支末 `open_file.cache_hit`（累计耗时）；未命中分支末 `open_file.cache_miss`（累计耗时）
- [x] 1.3 `_on_indexing_finished()`：`indexing.finished`（索引+缓存写入总耗时 + 行数）
- [x] 1.4 `_start_pipeline()`：入口 `pipeline.start`；get_pipeline/get_search 后 `pipeline.cache_lookup`（耗时 + 两个 hit 标志）；分支确定后 `pipeline.worker_start`（worker 或立即 emit 标志）
- [x] 1.5 `_on_pipeline_finished()`：`pipeline.finished`（总耗时 + indices/matches 数）
- [x] 1.6 `_calculate_log_level_stats()`：循环内 `stats.level.<LEVEL>`（每次 rg 耗时 + count）；循环后 `stats.total`
- [x] 1.7 `read_processed_lines()` 出口：`read_lines`（单次耗时 + 行数）

## 2. 前端打点

- [x] 2.1 新建 `frontend/src/utils/timing.ts`：`timingLog(stage, fileId?, extra?)`，`process.env.VITE_TIMING === '1'` 开关（vite define 注入），`[Timing] <stage> wall=<Date.now()> file=<fileId> <extra>`，关闭时零开销
- [x] 2.2 `vite.config.ts` `define` 注入 `process.env.VITE_TIMING`（读 `env.VITE_TIMING`）
- [x] 2.3 `useFileManagement.ts` `handleFileActivate` 与 `addNewFiles` 设置 loadingFileIds 处：`loading.start`
- [x] 2.4 `bridge_client.ts` `openFile()` fetch 前：`open_file.request`
- [x] 2.5 `App.tsx` `onOperationStarted`：`signal.operationStarted`；`onFileLoaded`：`signal.fileLoaded`；`onPipelineFinished`：`signal.pipelineFinished`；`onStatsFinished`：`signal.statsFinished`
- [x] 2.6 `useSearch.ts` syncAll 调用前：`sync_all.request`

## 3. 打点验证

- [x] 3.1 后端：`LOGLAYER_TIMING=1` 下打开一个小文件，确认 `[Timing]` 日志覆盖 open_file/索引/pipeline/stats 各阶段；未设置开关时无输出且无额外开销（`python3 -m pytest tests/unit -q` 通过，69 passed）
- [x] 3.2 前端：`npx tsc --noEmit` 通过；`npm run lint` 通过；Prettier 通过
- [x] 3.3 用户实测：打开 1.2KB 小文件 + 1.3GB 大文件（首次/缓存命中），前后端日志重建时间线 → **确认根因**（stats 6 次串行 rg 18.6s 与索引并行；fetchLogLevelStats 双调用；useBridge 信号重复注册；缓存命中 compute_file_hash 3.3s）

## 4. 根因修复（后端）

- [x] 4.1 `backend/bridge.py` `_calculate_log_level_stats()`：改为单次 rg（`-i -o --no-line-number -e '\b(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)\b'`）用 `collections.Counter` 聚合全部级别计数；保留 `stats.level.*`/`stats.total` 打点语义；返回 JSON 形状不变
- [x] 4.2 `backend/loglayer/metadata_cache.py`：`SqliteMetadataCache.get()` 缓存查找改为 `os.path.getsize` 与记录 `file_size` 对比，一致则跳过 `compute_file_hash` 直接命中；不一致才重算 hash 复核
- [x] 4.3 `backend/bridge.py` `_on_indexing_finished()`：`fileLoaded` emit 先行，`_write_cache` 放后台线程（序列化+压缩不阻塞打开）
- [x] 4.4 `backend/loglayer/metadata_cache.py`：新增 `get_offsets()`——内存 LRU 热缓存反序列化后的偏移数组（`cachetools.LRUCache`，key=file_path，命中时校验文件 size），避免大文件二次打开重复读磁盘 BLOB（WSL2 drvfs 上 40MB BLOB 读取数秒）；`put`/`invalidate`/`clear_all`/`close` 同步清理内存层
- [x] 4.5 `backend/bridge.py` `open_file()`：缓存命中路径改用 `get_offsets()` 一次性获取已反序列化偏移（不再 `get()`+`deserialize_offsets` 两步）
- [x] 4.6 `backend/bridge.py` `compute_search_matches()`：`set()` → `array('I')` 直接 append（rg 行号有序唯一），极端内存 600MB → 87MB
- [x] 4.7 `backend/loglayer/cache_store.py` `_MemCache`：改为 cachetools 字节模式（`getsizeof`），字节预算随 `cache_size_mb` 联动（默认 1% 派生，最小 1MB）；新增 `set_budget()`/`CacheStore.set_memory_budget()`
- [x] 4.8 `backend/bridge.py` `set_cache_size_mb()`：联动三层预算（SQLite 磁盘 + 偏移热缓存 + 过滤/搜索内存层），一次配置全生效

## 5. 根因修复（前端）

- [x] 5.1 `App.tsx`：移除 activeFileId effect（219-225）中的 `fetchLogLevelStats` 调用，仅保留 `onFileLoaded` 内一次调用；activeFileId 为空时仍清空 stats
- [x] 5.2 `frontend/src/hooks/useBridge.ts`：定位并修复信号重复注册（每个信号回调仅执行 1 次，connect 幂等/防重）

## 6. 修复验证

- [x] 6.1 后端：`_calculate_log_level_stats` 单次扫描结果与逐级别结果一致（单测）；小文件 stats 总耗时从 ~134ms 降至 ~30ms（4.4x）
- [x] 6.2 缓存：同文件二次打开 `open_file.cache_lookup` 从 3.3s 降至 0.4ms、`cache_hit` 从 1.8s 降至 1ms（内存热缓存，实测总耗时 ~1.5ms）；文件 size 变更/等大小改写均正确失效（单测 `test_get_offsets_memory_hit`）
- [x] 6.3 前端：`npx tsc --noEmit` + `npm run lint` + Prettier 通过；`signal.*` 不再成对出现（用户实测确认）
- [x] 6.5 内存联动：`set_cache_size_mb` 一次配置同时约束 SQLite 磁盘、偏移热缓存、过滤/搜索内存层（单测 `test_memory_budget_links_cache_size` 覆盖）；搜索匹配 set→array 已验证有序无重复
- [x] 6.4 用户实测：1.3GB 首次打开"正在加载流式日志"从 33s 降至 ~18s 内（索引纯扫描 17.7s，缓存写回已异步）；缓存命中打开从 ~5s 降至 <1s
