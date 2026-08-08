# Design: fix-slow-streaming-load (load-timing-observability)

## 目标

在前后端打开链路的关键阶段插入统一格式的时间戳耗时打点，默认关闭零开销。用一次真实打开（用户已确认为秒级）收集两端日志，重建完整时间线，定位秒级瓶颈阶段；该打点同时作为长期性能看护设施。

## 打点格式（前后端统一）

```
[Timing] <stage> wall=<epoch_ms> file=<file_id> <duration_ms>ms <extra>
```

- `wall`：`time.time() * 1000`（后端） / `Date.now()`（前端），同一毫秒时间轴，可直接跨端对齐。
- `duration_ms`：本阶段耗时（从该阶段起点到打点时刻）。
- 所有打点必须走统一入口（后端 `timing()` 函数 / 前端 `timingLog()`），禁止散落裸 print/console.log（遵循 AGENTS.md Debug 日志规范）。

## 开关

- 后端：`LOGLAYER_TIMING=1` 环境变量。`bridge.py` 模块加载时算一次 `TIMING_ENABLED`；关闭时计时函数立即 return，不调用 `time.time()`、不拼字符串（热路径零开销）。
- 前端：`VITE_TIMING=1` 构建期开关。在 `vite.config.ts` 的 `define` 注入 `process.env.VITE_TIMING`（与既有 `API_KEY` 注入模式一致），`timing.ts` 里封装 `timingLog()`，关闭时空操作。

## 后端打点位置（backend/bridge.py）

| 阶段标识 | 位置 | 打点内容 |
|---|---|---|
| `open_file.entry` | `open_file()` 入口 | 入口 wall 时间戳 |
| `open_file.cache_lookup` | `self._cache.get()` 后 | 查找耗时 + hit 与否 |
| `open_file.cache_hit` | 命中分支各步骤 | 反序列化偏移 / open_mmap / 书签恢复 / fileLoaded emit 累计耗时 |
| `open_file.cache_miss` | 未命中分支 | open_mmap / operationStarted emit / worker 启动累计耗时 |
| `indexing.finished` | `_on_indexing_finished` | 索引总耗时 + 行数（含缓存写入） |
| `pipeline.start` | `_start_pipeline` 入口 | 入口 wall 时间戳 |
| `pipeline.cache_lookup` | get_pipeline/get_search 后 | 查找耗时 + 两个 hit 标志 |
| `pipeline.worker_start` | 分支确定后 | 走 worker 还是立即 emit（cache 双命中/空管线） |
| `pipeline.finished` | `_on_pipeline_finished` | 管线总耗时 + indices/matches 数 |
| `stats.level.<LEVEL>` | `_calculate_log_level_stats` 循环内 | 每次 ripgrep 调用耗时 + count |
| `stats.total` | 循环后 | 6 次 rg 总耗时 |
| `read_lines` | `read_processed_lines` 出口 | 单次读取耗时 + 行数 |

实现方式：模块级 `TIMING_ENABLED` + 一个 `timing(stage, file_id, duration_ms, extra="")` 辅助函数；耗时用 `time.perf_counter()` 起止相减，`wall` 用 `time.time() * 1000`。

## 前端打点位置

| 阶段标识 | 位置 | 打点内容 |
|---|---|---|
| `loading.start` | `useFileManagement.ts` `handleFileActivate`/`addNewFiles` 设置 loadingFileIds 处 | "正在加载流式日志..." 出现的起点 |
| `open_file.request` | `bridge_client.ts` `openFile()` 内 fetch 发出前 | REST 请求发出 |
| `signal.operationStarted` | `App.tsx` `onOperationStarted` | 后端 operationStarted 到达 |
| `signal.fileLoaded` | `App.tsx` `onFileLoaded` | 后端 fileLoaded 到达（loading 结束点） |
| `sync_all.request` | `useSearch.ts` syncAll 调用处 | pipeline 触发请求发出 |
| `signal.pipelineFinished` | `App.tsx` `onPipelineFinished` | 管线完成信号到达 |
| `signal.statsFinished` | `App.tsx` `onStatsFinished` | 统计完成信号到达 |

实现方式：`frontend/src/utils/timing.ts` 新增 `timingLog(stage, fileId?, extra?)`，内部 `if (!TIMING_ENABLED) return;`，`console.log('[Timing] ...')`。`TIMING_ENABLED` 由 `process.env.VITE_TIMING === '1'` 决定（vite `define` 构建期注入）。

## 可观测性闭环

1. 用户设置 `LOGLAYER_TIMING=1` + `VITE_TIMING=1` 重启前后端。
2. 打开一个小文件（1.2KB）复现秒级加载。
3. 后端终端与浏览器 console 各得到一组 `[Timing]` 日志。
4. 按 `wall` 时间戳合并排序 → 得到完整打开时间线 → 定位秒级瓶颈阶段。
5. 打点常驻：后续任何打开异常都可复用同法圈定阶段（性能看护）。

## 阶段二：根因修复设计

实测结论（1.3GB/2291 万行 + 1.2KB 小文件，两端 wall 对齐）：
- 首次打开"正在加载流式日志"33s = 索引纯扫描 13s + **stats 6 次串行 rg 18.6s 与之并行争抢 IO**（索引被拖到 32.9s）。
- 缓存命中打开 ~5s = `compute_file_hash`（每次重读文件 16KB）+ SQLite 反序列化 2290 万偏移；随后 stats 又跑 11.8s（其中 ERROR 级 rg 冷缓存 9.7s）。
- stats 重复 2-3 组：`fetchLogLevelStats` 双调用（App.tsx activeFileId effect + onFileLoaded 各一次）+ useBridge 信号 connect 重复注册（每个信号回调执行 2 次）。

### 修复 1：stats 单次扫描（backend/bridge.py `_calculate_log_level_stats`）

现状：6 次循环，每次 `subprocess.run(rg -c -e '\b<LEVEL>\b' file)`，串行进程启动 + 重复读文件。

改为：**单次 ripgrep 输出所有级别并计数**，用 `-o --no-line-number` 提取匹配词 + `sort | uniq -c`：

```python
cmd = [self._rg_path, "-i", "-o", "--no-line-number", "-e",
       r"\b(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)\b", file_path]
# stdout: 每行一个匹配词（含重复），sort|uniq -c 得到各级别计数
```

实现细节：
- 用 `subprocess.run(..., capture_output=True)` 一次调用；stdout 按行 `counts = Counter(line.strip().upper() for line in out.splitlines())`。
- 无匹配时 rg 返回码 1 但 stdout 为空 → 全 0。
- 单次进程启动：小文件 ~10-20ms（原 200ms+），大文件一次扫描 ~3-5s（原 18.6s）。
- 保留 `stats.level.<LEVEL>` 打点语义（改为在 Counter 聚合后输出各 level 计数）。

### 修复 2：stats 与索引解耦（frontend App.tsx）

现状：`App.tsx:219-225` 的 activeFileId effect 在文件刚激活（索引未完成）时就 `fetchLogLevelStats`，与后端索引并行；`onFileLoaded`（App.tsx:472）又调一次 → 双调用。

改为：
- 移除 activeFileId effect 中的 `fetchLogLevelStats` 调用，仅保留 `onFileLoaded` 内的调用（文件加载完成后才拉取，后端 session 已就绪）。
- 保留 effect 的清空逻辑（activeFileId 为空时 reset），避免切文件时残留旧 stats。

### 修复 3：useBridge 信号重复注册（frontend useBridge.ts）

现状：`useBridge` 的 effect 依赖 `[]` 仅执行一次，但收到信号回调 **2 次**（日志中 operationStarted/fileLoaded/pipelineFinished/statsFinished 各出现 2 次 wall 相同或差 1ms）→ 说明 connect 被注册了两遍。

原因假设：`initBridge()` 或 Signal.connect 在模块级/多处被调用（如 StrictMode 双挂载、或 bridge_client 内部重复 init）。需定位 connect 实际注册次数：
- 检查 `bridge_client.ts` 的 `initBridge` 是否可被多次调用并重复建桥（`initPromise` 缓存是否存在）。
- 在 `useBridge` 的 effect 内对每个信号先 `disconnect` 旧回调再 `connect`（幂等），或确保 `initBridge` 只初始化一次。
- 验证：修复后每个信号回调只执行 1 次（打点日志中 `signal.*` 不再成对出现）。

### 修复 4：缓存命中复用 file_hash（backend/loglayer/metadata_cache.py）

现状：`SqliteMetadataCache.get()`（metadata_cache.py:158-189）每次都 `compute_file_hash`（打开文件读首尾 16KB + SHA-256）做一致性校验；`CachedFileIndex` 记录本身含 `file_hash`，但查找时仍重算 → 大文件 3.3s。

改为：
- `get()` 查找时**跳过重算 hash**，改用 `os.path.getsize`（~0.1ms）对比记录 `file_size`，一致则直接命中；不一致才 `compute_file_hash` 复核（保住等大小改写检测）。
- 验证：`open_file.cache_lookup` 从 3.3s 降到 <10ms，且文件被修改后缓存仍正确失效。

### 修复 4b：索引写回异步化（backend/bridge.py `_on_indexing_finished`）

现状：`_write_cache`（序列化 2290 万偏移 ~9s + zlib 压缩 + drvfs SQLite 写入）在 `fileLoaded` emit **之前**同步执行 → 首次打开"正在加载流式日志"被额外拖长 ~14.5s（实测 `indexing.finished` 32.3s vs 纯索引 [Indexing] 17.7s）。

改为：`fileLoaded` emit 先行，`_write_cache` 放 `threading.Thread(daemon=True)` 后台执行。首次打开 32s → ~18s（纯索引扫描）。

### 修复 4c：缓存偏移内存热缓存（backend/loglayer/metadata_cache.py `get_offsets`）

现状：缓存命中时 `open_file` 仍从 SQLite 读 40.7MB BLOB（WSL2 drvfs/9p 上实测 3.9s，`/tmp` 原生 fs 只要 90ms）+ 反序列化 1.4s。

改为：
- 新增 `get_offsets()`：内存 LRU（`cachetools.LRUCache`，字节预算随 `cache_size_mb` 联动，默认 2048MB）缓存**反序列化后的 `array('Q')` 偏移**（存 `(offsets, file_size)` 元组，命中时校验当前文件 size 防变更失效）；未命中才读 SQLite BLOB + 反序列化并回填内存。
- `put`/`invalidate`/`clear_all`/`close` 同步清理内存层。
- `open_file` 缓存命中路径直接调 `get_offsets()`（不再 `get()`+`deserialize_offsets` 两步）。
- 实测：二次打开 `cache_lookup` 0.4ms + `cache_hit` 1ms（原 5s，3000x）。

### 修复 5（低优先，本次不做）

- 前端 300ms syncAll debounce：打开文件无搜索词时跳过空管线 syncAll（mode=empty 仅 emit 信号，收益小，且与搜索联动耦合，留待后续）。
- WS 投递 ~100ms 延迟：与 uvicorn 线程池/事件循环调度相关，影响面大，暂不动。

## 阶段二不做的事

- 不改 REST API 形状与前端契约（stats 返回 JSON 结构不变）。
- 不引入新依赖（单次 rg 用 `-o` 标志，无需新工具）。
- 不动索引核心逻辑（mmap 扫描本身 95.9 MB/s 正常，非瓶颈）。
- 不动 WS 基础设施与 syncAll debounce（低收益/高风险，单独变更）。
