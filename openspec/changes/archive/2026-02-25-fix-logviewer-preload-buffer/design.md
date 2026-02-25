# Design: LogViewer 预加载优化

## Context

LogViewer 使用虚拟滚动技术渲染大量日志行。当滚动时，需要预加载可视区域外的行到缓存中。当前实现存在以下问题：
1. buffer 太小（200-500 行）
2. 动态 buffer 计算的乘数不够大
3. debounce 时间太短（10ms），请求过于频繁

## Goals / Non-Goals

**Goals:**
- 确保快速滚动时预加载足够多的行
- 减少加载延迟，提升用户体验

**Non-Goals:**
- 不改变整体架构
- 不添加 Web Worker 预加载（超出本次 scope）

## Decisions

### Decision 1: 增大基础 buffer

将 `BUFFER_NORMAL` 从 200 改为 800，`BUFFER_LARGE` 从 500 改为 1500。

Rationale: 更大的基础 buffer 能在大多数已加载。

### Decision 2: 优化动态 buffer 公式

将公式情况下保证内容从 `buffer = min(setting, base + velocity * 50)` 改为 `buffer = min(setting, base + velocity * 200)`。

Rationale: 原乘数 50 不够大，无法在快速滚动时提供足够缓冲。

### Decision 3: 调整 debounce 时间

将 `FETCH_DEBOUNCE_MS` 从 10ms 改为 50ms。

Rationale: 10ms 太短，几乎等于没有 debounce；50ms 能有效合并快速连续的滚动事件。

### Decision 4: 添加滚动方向预判

基于滚动方向，在前向（滚动到底部）时增加更多 buffer。

Rationale: 用户更常向下滚动查看新日志，向前预加载更重要。

---

对于一个小型优化，这个设计捕获了关键决策而不至于过度设计。
