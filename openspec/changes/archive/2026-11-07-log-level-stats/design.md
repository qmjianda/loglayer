# Design: log-level-stats

## Context

见 `proposal.md` — Why。当前实现的关键事实：

- `FileBridge._calculate_log_level_stats(file_path)` 每次调用都用
  `rg -i -o "\b(FATAL|ERROR|WARN|INFO|DEBUG|TRACE)\b"` 扫描整个文件，逐个匹配累加。
- `get_log_level_stats(file_id)` 没有缓存、没有并发控制，直接调用上述方法。
- 前端在"激活文件变化"与 `fileLoaded` 两处调用 `fetchLogLevelStats`；函数内没有请求序号，
  `setLogLevelStats` / `setStatsLoading` 无条件写入。
- 另有一套图层统计（`StatsWorker` + `statsFinished`），按图层分别跑 rg；本变更不改变它。
- 现有 `openspec/specs/log-level-stats-resilience/spec.md` 定义了 rg 缺失时的降级契约，
  本变更必须保持该行为不变。
- `CacheStore` 的 `_MemCache` 假设缓存值是数组（`_data_size` 按数组估算），不适合直接塞入
  6 个整数的统计对象；`SqliteMetadataCache` 已有 `(file_path, ...)` 表结构与 LRU 淘汰，
  但为 6 个整数单独建表收益有限。

## Goals / Non-Goals

**Goals:**

- 统计口径可解释：各级别数字对应"行数"，总和不超过文件行数。
- 切文件/重复请求的统计耗时从"每次 1s 级 rg"降为"命中即返回"。
- 同一文件的并发请求不重复扫描；不同文件不互相阻塞。
- 前端不会显示已切走文件的统计。

**Non-Goals:**

- 不改变图层统计（`StatsWorker`）的计数与缓存策略。
- 不改变"统计针对文件整体、不随图层/搜索过滤"的语义。
- 不改进级别 token 的启发式（行内任意位置出现即计入；`no error found` 仍计 ERROR）。
- 不做跨进程/持久化缓存（重启后首次仍需扫描一次）。
- 不新增"点击级别过滤"等 UI 交互（可另立变更）。

## Decisions

### D1：按行计，优先级归并

一行只归一个级别，优先级 `FATAL > ERROR > WARN > INFO > DEBUG > TRACE`，大小写不敏感。

- **为什么**：Inspector 的堆叠条表达的是"文件里各类行的占比"，不是 token 频次；
  按行计后 `sum(counts) <= line_count` 恒成立，用户可以直接用数字做判断。
- **替代方案**：保留出现次数（现状）——与 UI 语义冲突；同时返回两种口径——字段膨胀，
  且前端没有第二个消费场景。均不采用。

### D2：一次扫描 + 流式按行归并

命令保持单次 `rg`：

```
rg -o -n -i --no-filename --color never -e "\b(FATAL|ERROR|WARN|INFO|DEBUG|TRACE)\b" <file>
```

输出形如 `123:ERROR`，天然按行号升序。解析时维护"当前行号 + 该行已见最高优先级"，
行号变化即 flush，内存 O(1)。

- **为什么**：不逐行读文件（性能红线），输出量与现有 `-o` 相同，不会因为输出整行而在
  INFO 密集的日志上放大管道数据量。
- **替代方案**：
  - `rg --json`：结构化但每匹配一条 JSON，解析与内存开销显著更大。
  - 对每个级别跑一次 `rg -c`：6 次全文件扫描，比现状更慢。
  - 输出整行再解析：管道数据量可能从"每行一个 token"膨胀到"每行完整内容"，大文件不可接受。
- **实现注意**：显式 `encoding="utf-8", errors="replace"` 读取子进程输出，避免 Windows
  默认代码页影响解析；仍沿用 30s 超时与 returncode 0/1 语义。

### D3：进程内 LRU 缓存（键含 size + mtime_ns）

在 `FileBridge` 内维护有界字典：键 `(realpath, size, mtime_ns)`，值统计 dict；上限 64 个文件，
按最近使用淘汰。

- **为什么**：统计值只有 6 个整数，进程内缓存足以覆盖"切 tab/分屏来回切"的高频场景；
  键包含 size 与 mtime 让"文件变化"自然失效，无需额外监听。1.3GB 文件重启后首次扫描
  1s 可以接受，避免为极小数据引入 SQLite 迁移。
- **替代方案**：
  - `SqliteMetadataCache` 新增 `stats_cache` 表：可跨重启，但要处理表结构、LRU 字节统计、
    与现有 `enforce_limit` 的交互；收益（仅首次启动）不抵复杂度。
  - 复用 `CacheStore`：需要改 `_MemCache` 的"值为数组"假设，影响面更大。
- **失效**：键变化即视为失效；另提供 `invalidate_stats(path)` 供后续 live-tail 变更在
  追加/截断后显式清理，以及 `/api/cache/clear` 全量清理。

### D4：同一文件并发去重（per-key in-flight）

缓存未命中时，用 `(realpath, size, mtime_ns)` 作为 in-flight 键：第一个请求执行扫描，
其余请求等待同一个完成事件并复用结果；扫描结束（成功/失败）后移除 in-flight 记录。

- **为什么**：`fileLoaded` 与激活 effect 可能同时触发统计；快速切 tab 也会叠加请求。
- **替代方案**：全局锁——会让不同文件的统计串行，违背"不同文件并行"的 spec 场景。
- **失败语义**：扫描抛错时，等待者得到与执行者一致的空/错误结果，不缓存失败结果。

### D5：前端请求序号 + 激活校验

把 `fetchLogLevelStats` 从 `App.tsx` 抽成 `useLogLevelStats` hook：

- 每次请求自增 `requestSeq`，响应返回时只有 `seq === latestSeq` 且 `fileId` 仍是当前激活文件
  才写入 `stats` / `loading`；
- 切文件时立即清空旧统计并进入 loading，旧响应直接丢弃。

- **为什么**：当前实现存在可复现的覆盖竞态；抽 hook 后可以用 vitest 直接测，不再依赖
  App 的集成测试。
- **替代方案**：在 `App.tsx` 内加 ref 判断——可行但不可测，且继续膨胀编排层。

### D6：诊断与清理

- `/api/diagnostics` 在现有缓存统计旁增加 `stats` 的 hit/miss（复用 `CacheStore` 的
  计数命名风格）。
- `/api/cache/clear` 同时清空统计缓存与 in-flight 记录。

### D7：语义变更的迁移

响应字段不变，调用方无需改代码；但数字会变化。发布说明中标注"级别统计改为按行计"，
Inspector 的级别分布 tooltip 增加"按行统计"字样（纯文案，不改结构）。

## Risks / Trade-offs

- [数字变化被误认为 bug] → proposal/发布说明明确 BREAKING 口径；测试用例覆盖重复 token
  与多级别行，方便对照。
- [`rg -o -n` 输出格式在 Windows 的换行/编码差异] → 显式 UTF-8 解码 + `\r` 清理，并加
  跨平台单测（使用 `rg_path` fixture）。
- [mtime 精度不足导致缓存误命中] → 键同时包含 size；同 size 且同 mtime 的改写视为命中，
  与现有 `compute_file_hash` 的"size 优先"策略一致，属于可接受风险。
- [in-flight 等待者被慢扫描拖住] → 与"去重"目标一致；前端已有 loading 态，不额外优化。
- [缓存与 live-tail 交互] → 本变更只提供 `invalidate_stats(path)`；tail 变更负责在追加后调用，
  避免统计长期停留在旧值。

## Migration Plan

1. 合并后无需数据迁移；旧缓存（pipeline/search）不受影响。
2. 回滚：恢复 `_calculate_log_level_stats` 的出现次数实现、移除缓存与 hook 即可；
   API 字段未变，前端无需回滚配套。
3. 验证：`pytest`（新增 stats 单测）、`vitest`（hook 竞态）、`tsc/eslint/prettier`、e2e 冒烟。
