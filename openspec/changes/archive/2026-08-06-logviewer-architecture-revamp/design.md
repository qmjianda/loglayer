# logviewer-architecture-revamp — Design

## Context

当前 LogLayer 的搜索、过滤、渲染三条逻辑绑定在单一 `PipelineWorker` 管线中，视觉计算由后端逐行执行并烧入 `rendering_cache`，搜索状态为 App 级全局单例。这导致：

- 改一个搜索词 = 重跑整条管线 + 重建渲染缓存 + 前端全量重读（1.3GB 文件上代价高）
- 切 Tab 时搜索词/导航位置串扰（全局单例），无法 per-tab 独立高亮
- 视觉（高亮/行样式）由后端计算，物理上做不到 per-tab 多词同时高亮
- 添加新视觉图层必须写 Python 类并在后端逐行执行，摩擦大

本项目为桌面日志分析工具（pywebview + FastAPI + React），核心场景是大型日志（千万行、1.3GB）的错误追踪与性能分析。日志文件只读，因此计算结果可缓存复用（命中率近 100%），这是区别于代码编辑器（文件可编辑、缓存易失活）的架构红利。

**约束**（用户明确）：不兼容旧插件协议；允许大改；必须保证高性能图层/搜索、友好交互、架构可扩展、稳定；关键点可观测可测试；有成熟方案尽量不自研。

## Goals / Non-Goals

**Goals:**
- 过滤/转换（改变内容）留在后端高性能执行；渲染/搜索高亮全部前端化
- 搜索与过滤管线解耦，搜索改为请求时计算 + 结果缓存，支持取消/replace
- per-tab（面板级）独立搜索状态，交互对齐 VSCode
- 计算结果分层缓存（内存 LRU + SQLite），缓存命中率可见
- 图层协议 v2：类别即执行位置，添加图层的摩擦最小化
- 全链路可观测、可测试，1.3GB 大文件性能门禁

**Non-Goals:**
- 不重构 mmap 行索引内核（已达标，仅扩展缓存）
- 不做 FTS 全文索引（rg 流式扫描已足够快，避免自研搜索内核）
- 不迁移桌面壳（保持 pywebview）
- 不实现日志替换/编辑（只读查看器）
- 不处理 UIWidget（statusbar 挂件），本期搁置

## Decisions

### D1. 类别即执行位置（图层路由）

```
LayerCategory  →  engine  →  数据流
FILTERING      →  backend   →  visible_indices（rg 下沉 / logic python）
TRANSFORM      →  backend   →  content（transform 后文本）
RENDERING      →  frontend  →  segments / rowStyle（渲染器注册表）
```

- **选择理由**：铁律"改变显示行/内容 → 后端；只改变观 → 前端"自动决定路由，无需图层自己声明位置，杜绝"渲染层被误放后端执行"。
- **备选**：`engine` 字段单独声明。被否——多一个自由度就多一类错误，类别本身已蕴含执行位置。

### D2. 搜索与过滤解耦 + 请求时计算

现状：搜索在 `PipelineWorker` 内与过滤一起跑（bridge.py:323 vs :400 两段代码共享一次运行）。

目标：
```
打字（改词）   → 前端对可见行即时高亮（零网络、零后端）
F3/Enter/切tab → 后端按需计算匹配 → 缓存 → 返回匹配物理行号数组
```

- **选择理由**：per-tab 多状态下"改词即全量算"会爆炸；"导航时才要结果"把搜索从持续管线变为请求时计算。
- **备选**：保持持续管线 + 增量复用。被否——rg 全量扫描无法真增量，且与 per-tab 冲突。
- **配套**：`PipelineWorker` 支持 cancel/replace（新任务 replace 旧任务，zombie worker 清理沿用）。

### D3. 搜索结果缓存：物理行号 + 分层存储

- 缓存存**物理行号**（稳定、跨图层可复用），不存视觉索引（依赖过滤结果，图层一变全失效）；导航时用现有 `physical_to_visual_index`（search_mixin.py:72）换算。
- 缓存 key：
  ```
  file_hash    → 现成 compute_file_hash（前8KB+后8KB+size）
  layers_hash  → 图层完整配置 JSON 序列化 sha1（含 rg args 与逻辑层参数）
  query_hash   → (query, regex, caseSensitive, wholeWord) sha1
  ```
- 两级存储：热数据内存 LRU（`cachetools`），冷数据 SQLite（复用 `metadata_cache.py` 的 chunk+zlib + LRU 淘汰模式）。
- **选择理由**：与现有 `SqliteMetadataCache` 同构，代码模式可复用；冷热分离控制内存。
- **备选**：全部内存 / 全部 SQLite。被否——千万行多 query 全部内存会爆；全部 SQLite 高频导航有 IO 延迟。

### D4. per-tab 搜索状态：面板级 Map + zustand

```
useSearchStore（zustand）
  tabs: Record<panelId, {
    query, config, rank, matchIndices快照, matchCount
  }>
  activePanelId
```

- 状态 key 用 **panelId**（`log-view-<hash>`）而非 fileId——与 dockview 生命周期绑定，`onDidRemovePanel` 时销毁，布局恢复时 panelId 稳定、状态自然重挂。
- 后端 `LogSession.search_config/search_matches` 保持 per-file 权威（最后 sync 的词）；前端 per-tab 持有快照，切 tab 时若后端状态不匹配则静默重 sync（仅搜索，不动过滤）。
- **选择理由**：zustand 天然支持 Map 状态 + 快照/订阅/可测试；避免 Context 自研带来的 per-tab 状态管理 bug。
- **备选**：React Context + useReducer 自研。被否——per-tab 多实例状态用 Context 易出脏状态。

### D5. 前端渲染器注册表 + 通用规则引擎

```
渲染器注册表:  type → render(content, config) → {segments, rowStyle}
  内置: HIGHLIGHT / ROWTINT / LEVEL / BOOKMARK...
通用规则引擎:  { pattern, action: highlight|rowTint, color }[]
  → 配置即图层，90% 视觉需求零代码
```

- 渲染层在后端仅保留元数据注册（type/display_name/ui_schema/engine）供 `get_layer_registry` 生成配置表单；执行逻辑全部删除。
- 书签拆为"数据在后端（KV 持久化行号列表）+ 视觉在前端（对 marked 行着色）"。
- **选择理由**：规则引擎覆盖绝大多数视觉需求；独特视觉才写渲染器（纯函数，易测）。
- **备选**：渲染层声明式协议（后端算 segments 前端只绘制）。被否——保留后端计算违背性能与 per-tab 目标。

### D6. 可观测性：计时 + 命中统计 + 状态快照

```
后端: 管线阶段计时器（filter/transform/search 每段耗时）+ 缓存 hit/miss 统计
前端: Debug overlay（Ctrl+Shift+D）→ per-tab 状态快照 + 事件流 + 缓存统计
```

- 纯函数化是埋点前提：计时/统计不侵入业务逻辑。
- **选择理由**：桌面应用 Debug 成本高，关键点黑盒则重构无法定位根因；缓存命中率是验证缓存设计正确性的唯一依据。
- **备选**：OpenTelemetry 等重型监控。被否——单机桌面应用过重。

### D7. 少自研：成熟方案优先

| 组件 | 结论 |
|:--|:--|
| 搜索内核 | ripgrep（已用，不自研，不做 FTS） |
| 多 Tab 布局 | dockview（已用） |
| 内存缓存 | `cachetools`（替换自研 LRUCache） |
| 前端状态 | zustand（per-tab Map 状态） |
| 虚拟滚动 | 评估 TanStack Virtual，仅当收益大于刚完成的自研窗口化（commit 3a9b38c）才换 |
| 命令面板 | cmdk（评估） |

## Risks / Trade-offs

- **[搜索匹配与高亮可能不同步]** transform 修改内容后，行命中按原始行（rg）、行内高亮按显示文本 → 行高亮但文本不含关键词。→ 接受为已知权衡；无 transform 时完全一致。
- **[缓存误命中]** file_hash 校验（前8KB+后8KB+size）存在理论碰撞 → 沿用现有校验；缓存错过的代价是显示旧内容，故失效优先（宁可 miss 不可 stale）。
- **[渲染器质量参差]** 前端化后每个渲染器独立实现 → 渲染器接口契约 + 单测/快照测试 + 沙箱 try/catch 降级，坏渲染器只失效该层不白屏。
- **[per-tab 内存膨胀]** tab 数 × 查询数 × 匹配数组 → 快照只存导航所需（rank + 必要索引），全量数组走后端缓存；LRU 字节上限。
- **[大改回归]** 重构面广 → 三阶段落地，每阶段独立可交付可回退；1.3GB 门禁（打开/搜索/滚动/F3 跳转）性能与内存基线对比；Playwright e2e。
- **[并发管线堆积]** 快速连续操作排队跑完 → 取消/replace 语义 + zombie worker 清理（已有雏形）。

## Migration Plan

```
Phase 1  后端数据流解耦 + 缓存层（前端行为不变，风险最小）
         - 搜索从 PipelineWorker 拆出；匹配改存物理行号
         - CacheStore 统一层（cachetools LRU + SQLite 扩展表）
         - pipeline cancel/replace
Phase 2  前端渲染层落地 + per-tab
         - 高亮前移（渲染器注册表 + 规则引擎 + 搜索高亮）
         - 删除后端 rendering 逐行计算；书签数据/视觉分离
         - per-tab 状态（zustand）；find widget 对齐 VSCode
Phase 3  搜索体验增强
         - Search View 结果列表、reveal 居中、快捷键完善、配置持久化
```

每阶段结束：全量单测 + e2e + 1.3GB 门禁通过方可进入下一阶段。回退策略：git revert 到上一阶段交付点（阶段间无耦合提交）。

## Open Questions

1. 渲染层"规则引擎"的规则 schema 具体形态（pattern/action/color 的字段集）—— 建议 Phase 2 细化，随首个内置渲染层落地
2. 同文件双面板（未来分屏）时 per-tab 状态与后端 per-file search_matches 的同步策略 —— 当前单面板架构下不阻塞，预留 panelId key
3. 搜索配置（Aa/正则/全字）per-tab 记忆还是全局 —— 倾向 per-tab（VSCode 语义），待交互确认
4. Tab 关闭时搜索状态销毁还是持久化（wasOpen 重开复活）—— 倾向销毁，Phase 3 再议
