# Proposal: log-level-stats

## Why

当前文件级日志统计存在三个问题：

1. **口径不一致**：后端用 `rg -o` 统计"关键字出现次数"，同一行重复出现 `ERROR` 会计多次，一行同时含 `WARN` 与 `ERROR` 会同时计入两个级别，导致 Inspector 上各级别数字之和可能大于文件行数。
2. **重复扫描**：每次切换激活文件（以及 `fileLoaded` 与激活 effect 同时触发时）都会重新跑一次全文件 ripgrep；1.3GB 文件约 1 秒，来回切 tab 时体感明显。
3. **前端竞态**：从大文件 A 快速切到小文件 B 时，A 的迟到响应会覆盖 B 的统计与加载态。

统计是右侧操作台的核心信息之一，上述问题直接影响"看到的数字是否可信"和"切文件是否即时"。

## What Changes

- **BREAKING（口径）**：级别统计从"出现次数"改为"按行计数"——一行只归入一个级别，优先级 `FATAL > ERROR > WARN > INFO > DEBUG > TRACE`，大小写不敏感；响应字段名不变。
- 新增进程内统计缓存：键为 `(realpath, size, mtime_ns)`，命中不启动 ripgrep；文件变化即失效；LRU 上限避免无界增长。
- 同一文件的并发统计请求去重：只执行一次扫描，其余请求复用结果。
- 修复前端统计请求竞态：只有当前激活文件的响应可以写入状态，过期响应丢弃。
- `/api/diagnostics` 暴露 stats 缓存 hit/miss；`/api/cache/clear` 同时清理 stats 缓存。
- 删除未被引用的 `frontend/src/hooks/useLogStats.ts`。

## Capabilities

### New Capabilities

- `log-level-stats`: 文件级日志级别统计的计数口径（按行 + 优先级）、进程内缓存与失效、并发去重，以及前端统计请求的竞态约束。

### Modified Capabilities

（无。`log-level-stats-resilience` 的 rg 缺失降级行为保持不变；`right-inspector-panel` 的展示结构不变。）

## Impact

- **后端**：`backend/bridge/file_bridge.py`（`_calculate_log_level_stats` / `get_log_level_stats` / 缓存与失效 / 诊断）、`backend/main.py`（`/api/diagnostics`、`/api/cache/clear`）。
- **前端**：`frontend/src/App.tsx`（把统计拉取逻辑抽为可测 hook，加入请求序号/激活校验）、删除 `frontend/src/hooks/useLogStats.ts`。
- **测试**：新增 `tests/unit/test_log_level_stats.py`（口径、缓存、并发、rg 缺失回归）；新增前端 hook 测试（竞态）。
- **API 契约**：`/api/log_level_stats` 响应字段不变，仅数值口径变化；无新增依赖。
- **非目标**：不改变图层统计（`StatsWorker`）的缓存策略；不改变"统计针对文件整体、不随图层/搜索过滤"的现有语义；不改进级别识别的启发式（行内任意位置出现 token 仍会计入，如 `no error found`）。
