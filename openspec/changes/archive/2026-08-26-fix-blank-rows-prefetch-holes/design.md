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

> **2026-08-24 现场补充（1.2GB 真空无行号，偶发，大距拖动自愈）**：
> 上述 A/C 产生的是 `skeleton`（`LogRow.tsx:308` 灰条 + 行号仍在，`isLoaded=false`），与用户报告的"真空无行号"不一致。真空表象对应**无 DOM 行**，即 `windowStart/End` 未覆盖视口，指向新增假设 D：
> D. 超大文件缩放视口失步（`useScaling=true` 时 `logicalScrollTop = scrollTop/maxPhysical * maxLogical`，`windowStart` 滞后阈值 `windowBuffer*0.5` + `viewportHeight` 异步测量导致 `desiredWindowStart` 计算滞后，一帧内 `computeViewportTranslateY` 把内容移出视口，视口只剩 spacer 背景）。
> 触发条件与 1.2GB 强相关：`realTotalHeight≈240M > MAX_SCROLL_HEIGHT=30M` → 缩放比≈8×，`viewportHeight` 初始 0→600 的跳变会放大 `topVisibleLine` 误差。A 仍为小文件骨架洞的主因，D 为 1.2GB 真空洞的候选主因，两类表象需分探针区分。

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

- `lastFetchRef` 改为仅在"返回结果覆盖了请求区间"时写入（失败、空响应、长度不足均不写）；判定条件为 `lines.length === end - start` 且无 `null` 占位缺口（`bridge_client.readProcessedLines` 吞错返回 `[]` 属于空响应，同样不标记）。effect 的重跑由既有依赖（windowStart/windowSize/updateTrigger）驱动，另加一个轻量定时兜底（如渲染周期内对未覆盖窗口的一次补拉调度），保证无外部信号时也能自愈。
- **探针前置校验**：先以 D4 探针区分空响应来源（`mmap==None/closed` vs 网络错误）再冻结重试上限；探针确认 A 为主因后，D1 空数组不标记即为必改项。
- **备选**：fetch 内部 catch 里直接同步重试——退避策略复杂化，且空响应不算异常不走 catch，覆盖不全。

### D2: 渲染窗口覆盖对账

- 在 bridgedLines 更新与窗口变化两个触发点上，校验 `[windowStart, windowEnd)` 是否全部命中缓存；缺失子区间合并为一次补拉请求（复用 computePrefetchRange 风格的工具函数，放 utils 并配单测）。对账仅针对已渲染窗口，不扩大至整个预取区间，避免阈值未变时高频拉取。
- **探针联动**：D4 记录每次对账的 `windowStart/End、缺口子区间、触发源（window变化/缓存更新/定时兜底）`，用于区分"阈值卡死"与"空响应洞"。
- **备选**：渲染时对 undefined 行单独发请求——请求碎片化，违背批量拉取设计。
- **备选**：只靠 updateTrigger 全量重拉——数据大时浪费，且信号可能早于挂载错过。

### D3: 后端显式占位协议

- `read_processed_lines` 返回结构改为定长数组：无法提供的行以 `null` 占位（JSON 数组内 null），或每项携带 `{index, content|null}`。选 **null 占位定长数组**——改动最小，前端只需判 null 跳过写入并记入缺口集合。
- 同步修改前端回填循环：null 不写入 map，纳入 D2 缺口对账。
- **备选**：带 index 的对象数组——更明确但需改所有消费方与测试，收益不增。

### D4: Debug 探针（本次优先落地，阻塞 tasks 优先级冻结）

- 前端 `LogViewer.tsx` fetch 点位增加门控日志（`LOGLAYER_DEBUG`/`VITE_DEBUG`，关闭零开销，热路径 O(1) 判断不拼接字符串）：
  - ` [Fetch] range=[s,e) rows=N expected=M ms=T fileId window=[ws,we) trigger=window|cache|timer|updateTrigger`
  - 对账点位：`[Reconcile] window=[ws,we) gaps=[[s,e),...] bridgedSize=N`
- 后端 `file_bridge.py:read_processed_lines` 入口增加门控日志：
  - ` [Read] fileId range=[s,e) total=N mmap=ok|None|closed v_indices=len|None cacheHit=N`
  - 异常分支（`continue` 压缩点位）改为 `null` 占位前先计数 `skipped=N`，与 D3 联动验证错位是否发生
- 复现步骤（一次即可区分）：
  1. `LOGLAYER_DEBUG=1 python backend/main.py --no-ui` + 前端 `VITE_DEBUG=1 npm run dev`
  2. 打开 100k+ 行文件，立即滚动至中部再回顶部（tasks 1.4 e2e 同款），观察首屏骨架行是否在 `pipelineFinished` 前出现 `[Fetch] rows=0` 及后端 `[Read] mmap=None`
  3. 若 `rows=0 + mmap!=ok` 且无 error，则为 C 竞态；若 `rows=0 + mmap=ok`，则为网络/吞错；若 `rows<M` 但后端无 skipped，则为 A 标记固化
- 探针结论决定任务优先级：若 C 为主因，优先合并 D1 空数组不标记 + D2 对账；若阈值卡死，D2 节流参数再调优。
- **大文件真空补充探针**（针对 1.2GB 报告）：在 `LogViewer.tsx:193` 与 `:565` 处追加门控日志 ` [Viewport] ws=[ws,we) desired=... topVisible=... logical=... physical=... vpH=... scaling=bool ratio=... itemCount=...`，对比真空发生时 `topVisible ∉ [ws,we)` 是否成立即可判定 D。

## Risks / Trade-offs

- [lastFetchRef 语义弱化后同区间重复请求增多] => 对账只在窗口变化/缓存更新时触发且有去重标记兜底，正常路径请求数不增；仅异常路径多一次重试。
- [null 占位需要前后端同步发布] => 单仓库同进程部署，无版本漂移风险；集成测试覆盖两端。
- [定时兜底可能在管线长时间运行时空转] => 补拉受 updateTrigger 重置节流，空转成本为一次 O(1) 对账判断。

## Migration Plan

纯代码修复，无数据迁移。后端返回结构变更需同一提交内完成前端适配，集成测试（tests/integration/test_virtualization.py 已覆盖该端点）同步更新。

## Open Questions

- 空洞自愈的重试上限与间隔（建议：对账驱动天然有界，无需额外计数器；实现阶段验证即可）。
- 1.2GB 真空是否确为 D 视口失步而非 A 空洞：需一次带 `[Viewport]` 日志的现场复现确认；若 D 成立，修复点在 `desiredWindowStart` 阈值/缩放比快照，而非仅拉取层。
