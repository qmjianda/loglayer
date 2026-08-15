# Proposal: fix-scroll-empty-screen

## Why

GitHub issue #6「logview 翻页优化」：滚动日志（滚轮 / 拖进度条）时频繁出现占位/未加载的行。目标为「尽力而为」——滚动时**尽可能**显示真实文本，允许偶发占位（合理取舍，非强保证）。

根因（已由代码分析确认，非猜测）：

1. **滚动中所有在途请求被取消**：LogViewer 的 fetch 用「50ms 防抖 + cleanup 设 `ignore=true`」的组合，窗口一旦变化，在途请求结果全部被丢弃。连续滚动时没有任何 fetch 结果能落到缓存，唯一防线只剩 50 行静态 buffer。
2. **buffer 太小且常量未接线**：`windowBuffer = Math.max(50, visibleRows)` 硬编码；`constants.ts` 中 `BUFFER_NORMAL = 800` 早已定义却从未被 LogViewer 使用。

## What Changes

- **静态对称预取 + 在途不取消**：滚动时按「可视区 ± M」取整段（M 为配置常量，默认 100，成熟参照 AG Grid `cacheBlockSize`，无方向、无速度、无动态）；窗口 re-anchor 时立即拉取（无时间防抖），在途请求不取消，返回即按行号幂等合并到缓存。
- **数据变化清空缓存**：文件重新索引 / 图层 / 搜索变化（`updateTrigger`）时清空前端行缓存，避免显示陈旧文本（正确性不变式）。

## 本次不做的范围（已评审决定）

- **方向/速度预测预取（原 D2）**：引入方向判断复杂度；`useVirtualScroll` 的预测函数是未接线的死代码（正确性未知），弃用。
- **缓存命中跳过（原 D1）**：区间拆分逻辑复杂；与「重叠冗余可接受」的取舍冲突，不做（可选加「整段已缓存则跳过」留后续）。
- **字节预算缓存（原 D3）**：内存优化，与真实文本延迟无关。
- **去冗余 syncAll（原 D4）**：切 tab 场景，与滚动空白屏无关。
- **可见区优先分片拉取**：拖条 teleport 的微优化，被「在途不取消 + M 缓冲」覆盖，作为后续可选。
- **迁移到 react-virtuoso**：千万行滚动缩放是硬需求，react-virtuoso 无此能力（见 design D4）。

## Capabilities

### New Capabilities

（无 —— 本变更为修正/补强既有行为，不引入新能力。）

### Modified Capabilities

- `preload-optimization`: 「预加载 buffer 充足」改为「可视区前后各 M 行静态对称预取」；「Request Debouncing」由「防抖 + 取消在途」改为「节流 + 在途不取消」。
- `log-viewer-lazy-loading`: 「按需拉取行数据」补充「数据变化清空缓存」的失效语义。

## Impact

- **前端**：`frontend/src/components/LogViewer.tsx`（fetch 策略重写：节流 + 在途不取消 + 可视 ±M + updateTrigger 清空）、`frontend/src/constants.ts`（新增 `PREFETCH_BUFFER` 配置，弃用 `useVirtualScroll` 预测）。
- **测试**：单测（预取范围计算）+ e2e（滚动不空白、滚动中缓存持续填充、数据变化后不显示陈旧行）。
- **性能红线**：所有改动保持虚拟化 O(1)；缓存有界（`MAX_CACHED_LINES` 淘汰）；调试日志走统一开关。
