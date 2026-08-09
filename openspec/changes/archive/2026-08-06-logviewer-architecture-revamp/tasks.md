# logviewer-architecture-revamp — Tasks

按 design 三阶段落地。每阶段结束必须通过：全量单测 + e2e + 1.3GB 大文件门禁（打开/搜索/滚动/F3 跳转）。

## 1. Phase 1：后端数据流解耦 + 缓存层

- [x] 1.1 搜索匹配从 PipelineWorker 拆出为独立函数 `compute_search_matches(file_id, query_config)`，返回匹配物理行号数组
- [x] 1.2 LogSession.search_matches 语义改为物理行号存储（不再存可见行视觉索引）
- [x] 1.3 新增缓存 key 工具：`compute_layers_hash(layers_config)`、`compute_query_hash(query_config)`（复用 compute_file_hash）
- [x] 1.4 引入 cachetools 替代自研 LRUCache（bridge.py:57），热数据缓存层落地
- [x] 1.5 metadata_cache.py 扩展两张表：`pipeline_cache`（(file,layers) → visible_indices blob）、`search_cache`（(file,query) → 匹配物理行号 blob），沿用 chunk+zlib 与 LRU 淘汰
- [x] 1.6 CacheStore 统一访问层：get/put/invalidate + hit/miss 统计 + 两级存储路由（内存 LRU / SQLite）
- [x] 1.7 过滤结果缓存接入：sync_layers 时按 (file_hash, layers_hash) 查缓存，命中跳过过滤管线
- [x] 1.8 搜索请求时计算：新增/改造搜索端点，F3/Enter 导航时按 (file_hash, query_hash) 查缓存，miss 才后台计算并推送 WS 就绪信号
- [x] 1.9 PipelineWorker 取消/replace：新任务取代旧任务，zombie worker 及时清理
- [x] 1.10 单测：缓存 key 确定性（同输入同 key/不同输入不同 key）、搜索解耦（改词不重跑过滤）、缓存命中/失效、物理行号换算
- [x] 1.11 Phase 1 门禁：全量 pytest + e2e 通过；1.3GB 文件打开/搜索基线对比

## 2. Phase 2：前端渲染层落地 + per-tab

- [x] 2.1 引入 zustand，实现 per-tab 搜索状态 store：`Record<panelId, TabState>` + activePanelId
- [x] 2.2 EditorArea 传递 panelId（onDidActivePanelChange 提供面板 id）；面板关闭时销毁对应 TabState
- [x] 2.3 前端渲染器注册表：`type → render(content, config)` 接口 + 纯函数契约 + 错误隔离（try/catch 降级）
- [x] 2.4 通用规则引擎：规则配置（pattern/action/color）→ segments/rowStyle，配置即图层
- [x] 2.5 搜索高亮前移：LogViewer/LogRow 对可见行按 per-tab 词/配置计算高亮（memoize by content+query），当前匹配/其他匹配异色
- [x] 2.6 删除后端 rendering 逐行计算（bridge.py:1531-1546 的 highlight_line/get_row_style/搜索正则），rendering_cache 只存 content
- [x] 2.7 图层协议 v2：后端 registry 渲染层仅元数据（category/engine 字段），`get_layer_registry` 下发 engine；DataProcessingLayer 旧机制退役
- [x] 2.8 书签数据/视觉分离：后端仅提供书签行号列表（KV 持久化），前端渲染书签样式
- [x] 2.9 find widget 交互对齐 VSCode：Esc 两段式、无结果红框、Enter/Shift+Enter、F3 循环
- [x] 2.10 切 tab 状态恢复：切换面板后该面板词/配置/rank 恢复；后端状态不匹配时静默重 sync（仅搜索）
- [x] 2.11 单测：渲染器快照测试（给定 content/config → segments 精确比对）、规则引擎、per-tab 状态机、TabState 生命周期
- [x] 2.12 Phase 2 门禁：全量 pytest + Playwright e2e（含多面板搜索独立性）；1.3GB 滚动/搜索性能对比

## 3. Phase 3：搜索体验增强 + 可观测性

- [x] 3.1 Search View 结果列表（侧边栏）：虚拟化列表 + 行预览 + 点击跳转（复用 getSearchMatchesRange 能力）
- [x] 3.2 跳转行为增强：匹配 reveal 居中、跳转后匹配文本可见
- [x] 3.3 搜索配置持久化决策落地：per-tab 配置记忆或全局配置（按 Open Question 3 结论）
- [x] 3.4 后端可观测：管线阶段计时器（filter/transform/search 每段耗时）+ 缓存 hit/miss 统计接口
- [x] 3.5 前端 Debug overlay（Ctrl+Shift+D）：per-tab 状态快照 + 事件流 + 缓存统计
- [x] 3.6 搜索状态持久化评估（Tab 关闭销毁 vs wasOpen 复活，按 Open Question 4 结论）
- [x] 3.7 引入 cmdk 或保留自研命令面板（评估后决定）；TanStack Virtual 替换评估（仅当收益大于现自研窗口化）
- [x] 3.8 单测 + e2e：Search View 跳转、可观测数据正确性、Debug overlay 开关
- [x] 3.9 Phase 3 门禁：全量回归 + 1.3GB 性能/内存基线对比 + 打包验证（PyInstaller）

## 4. 收尾

- [x] 4.1 更新 AGENTS.md 架构描述（图层执行位置、per-tab 搜索、缓存层）
- [x] 4.2 清理遗留：删除自研 LRUCache、旧插件兼容代码、LogViewer 死 props（searchQuery/searchConfig）
- [x] 4.3 全量验证：openspec-cn verify + 最终门禁
