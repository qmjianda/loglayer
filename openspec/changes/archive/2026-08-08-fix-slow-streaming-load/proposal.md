# Proposal: fix-slow-streaming-load

## Why

打开任意日志文件（即使 1.2KB 的小文件、即使后端缓存命中）时，前端状态栏都会长时间显示"正在加载流式日志..."，达到**秒级**。目前代码库缺少跨前后端各阶段的耗时观测，无法定位瓶颈出在打开链路的哪一环（REST 请求、mmap 索引、缓存反序列化、pipeline 管线、stats 计算、WS 信号投递、前端状态切换……）。

**根因已通过两端时间戳日志实测确认**（1.3GB / 2291 万行 + 1.2KB 小文件）：
1. `_calculate_log_level_stats` 每次对 6 个日志级别**串行启动 6 次 ripgrep 子进程**：小文件每次 30-75ms（进程启动固定开销），大文件每次 240ms-16s（真实扫描）；且首次打开时在索引完成前就由前端 activeFileId effect 触发，与索引**并行争抢 IO**（索引从 13s 被拖到 32.9s）。
2. 前端 `fetchLogLevelStats` 双调用 + useBridge 信号**重复注册**（每个信号回调跑 2 次）→ stats 至少重复计算 2-3 组。
3. 缓存命中路径固定 ~5s 成本：`compute_file_hash`（每次重读文件 16KB + SHA-256）+ SQLite 反序列化 2290 万偏移量。
4. 前端 300ms syncAll debounce 固定等待 + WS 信号投递 ~100ms 延迟。

## What Changes

### 阶段一：耗时打点（已完成）

1. **后端阶段耗时打点**（`backend/bridge.py` 打开/pipeline 链路）：
   - `open_file`：入口、缓存查找、缓存命中分支（反序列化偏移/open_mmap/书签恢复/fileLoaded emit）、缓存未命中分支（open_mmap/operationStarted emit/worker 启动）
   - `_on_indexing_finished`：索引完成总耗时与行数
   - `_start_pipeline`：缓存查找耗时与命中与否、worker 启动、pipelineFinished emit
   - `PipelineWorker`/`StatsWorker` 完成总耗时
   - `_calculate_log_level_stats`：每次 ripgrep 调用耗时 + 总耗时
   - `read_processed_lines`：读取耗时（热路径，仅开关开启时计）
2. **前端阶段耗时打点**（打开链路）：
   - `useFileManagement`：loading 状态开始（"正在加载流式日志..."出现的起点）
   - `bridge_client.openFile`：REST 请求发出
   - `App.tsx` 信号回调：`operationStarted`/`fileLoaded`/`pipelineFinished`/`statsFinished` 到达时刻
   - `useSearch` syncAll 触发时刻
3. **统一开关**（默认关闭，零开销）：
   - 后端：环境变量 `LOGLAYER_TIMING=1`
   - 前端：`VITE_TIMING=1`（vite 构建期注入）
4. **统一格式**：`[Timing]` 前缀 + wall-clock 毫秒时间戳 + 阶段名 + file_id + 耗时 ms，可跨前后端对齐时间线。

### 阶段二：根因修复（本阶段目标）

1. **stats 计算去重合并**：`_calculate_log_level_stats` 改为**单次 ripgrep 扫描同时统计全部 6 个级别**（`rg -o '\b(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)\b' | sort | uniq -c` 或等价一次性正则），消除 6 次串行进程启动与重复扫描；大文件下 18.6s → 约 3s。
2. **首次打开不再让 stats 与索引并行**：前端 `fetchLogLevelStats` 仅在文件加载完成（fileLoaded 信号到达）后触发，activeFileId effect 不再提前拉取；索引从 32.9s 回落到纯扫描 ~13s。
3. **消除 stats 重复计算**：修复 useBridge 信号重复注册（effect 幂等），合并 `fetchLogLevelStats` 双调用路径。
4. **缓存命中加速**：`SqliteMetadataCache` 缓存记录中复用已存 file_hash，避免每次打开重算（cache_lookup 3.3s → ~10ms）。

## Capabilities

### New Capabilities

- `load-timing-observability`: 文件打开链路的跨前后端阶段耗时观测（打点、开关、格式）
- `file-open-performance`: 文件打开链路的性能优化（stats 单次扫描、索引与 stats 解耦、缓存 hash 复用）

### Modified Capabilities

（无现有能力规范被修改）

## Impact

- `backend/bridge.py`：新增计时辅助与各阶段打点（默认关闭，无行为变化）；`_calculate_log_level_stats` 重构为单次扫描；缓存 hash 复用
- `backend/loglayer/metadata_cache.py`：缓存记录复用 file_hash，跳过重复计算
- `frontend/src/utils/timing.ts`（新增）：前端计时 logger 工具
- `frontend/src/hooks/useFileManagement.ts`、`frontend/src/bridge_client.ts`、`frontend/src/App.tsx`、`frontend/src/hooks/useSearch.ts`：插入打点调用；`fetchLogLevelStats` 触发时机调整
- `frontend/src/hooks/useBridge.ts`：修复信号重复注册
- `vite.config.ts`：注入 `VITE_TIMING` 构建期开关
- 无 API/数据结构变更（stats 仍返回相同 JSON 形状）；无新增依赖
