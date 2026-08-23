# fix-blank-rows-prefetch-holes 设计

## Context

拉取链路（`LogViewer.tsx:356-392`）：

```
windowStart/End 变化
  → computePrefetchRange（±PREFETCH_BUFFER=300）
  → 去重检查 lastFetchRef（先写标记 :370，再 await）
  → readProcessedLines → setBridgedLines 逐偏移回填
```

窗口平移滞后：`|desired - prev| >= windowBuffer * 0.5` 才更新 windowStart（:195-202）。`updateTrigger` 变化会重置 lastFetchRef 触发重拉，但依赖 pipelineFinished 信号时序。

后端 `read_processed_lines`（file_bridge.py:1026-1097）逐行 try/except `continue` + 越界 `continue`，结果数组被压缩；前端按 `start + idx` 回填即错位。后端另有 `rendering_cache[i]` 以逻辑行号为键的缓存，跨管线运行的失效性本变更不处理（另案）。

空洞成因假设（探针验证后确认主因）：A. 失败/空响应被永久吞掉；B. 管线就绪信号与首次读取竞态；C. 后端跳行压缩错位。

## Goals / Non-Goals

**Goals:**

- 空洞自愈：任何成因产生的占位行都能在无需用户大幅滚动的情况下补齐。
- 消除数组压缩错位隐患。
- 提供可观测性以区分 A/B/C 成因。

**Non-Goals:**

- 不改动窗口滞后阈值本身（性能设计，保持不动）。
- 不处理后端 rendering_cache 跨管线陈旧问题。
- 不引入 WebSocket 推送行数据等架构级改造。

## Decisions

### D1: 标记时机后置 + 结果校验

- `lastFetchRef` 改为仅在"返回结果覆盖了请求区间"时写入（失败、空响应、长度不足均不写）；effect 的重跑由既有依赖（windowStart/windowSize/updateTrigger）驱动，另加一个轻量定时兜底（如渲染周期内对未覆盖窗口的一次补拉调度），保证无外部信号时也能自愈。
- **备选**：fetch 内部 catch 里直接同步重试——退避策略复杂化，且空响应不算异常不走 catch，覆盖不全。

### D2: 渲染窗口覆盖对账

- 在 bridgedLines 更新与窗口变化两个触发点上，校验 `[windowStart, windowEnd)` 是否全部命中缓存；缺失子区间合并为一次补拉请求（复用 computePrefetchRange 风格的工具函数，放 utils 并配单测）。
- **备选**：渲染时对 undefined 行单独发请求——请求碎片化，违背批量拉取设计。
- **备选**：只靠 updateTrigger 全量重拉——数据大时浪费，且信号可能早于挂载错过。

### D3: 后端显式占位协议

- `read_processed_lines` 返回结构改为定长数组：无法提供的行以 `null` 占位（JSON 数组内 null），或每项携带 `{index, content|null}`。选 **null 占位定长数组**——改动最小，前端只需判 null 跳过写入并记入缺口集合。
- 同步修改前端回填循环：null 不写入 map，纳入 D2 缺口对账。
- **备选**：带 index 的对象数组——更明确但需改所有消费方与测试，收益不增。

### D4: Debug 探针

- fetch 点位增加 `[Fetch] range=[s,e) rows=N ms=T` 条件日志（LOGLAYER_DEBUG 门控，关闭零开销），复现一次即可定位主因是 A/B/C 中哪个。

## Risks / Trade-offs

- [lastFetchRef 语义弱化后同区间重复请求增多] => 对账只在窗口变化/缓存更新时触发且有去重标记兜底，正常路径请求数不增；仅异常路径多一次重试。
- [null 占位需要前后端同步发布] => 单仓库同进程部署，无版本漂移风险；集成测试覆盖两端。
- [定时兜底可能在管线长时间运行时空转] => 补拉受 updateTrigger 重置节流，空转成本为一次 O(1) 对账判断。

## Migration Plan

纯代码修复，无数据迁移。后端返回结构变更需同一提交内完成前端适配，集成测试（tests/integration/test_virtualization.py 已覆盖该端点）同步更新。

## Open Questions

- 空洞自愈的重试上限与间隔（建议：对账驱动天然有界，无需额外计数器；实现阶段验证即可）。
