# Proposal: fix-search-mode-parity

## Why

搜索有两个用户可见的"假开关"：

1. **整词（wholeWord）只影响高亮，不影响匹配集**。前端高亮渲染器会用词边界包裹查询（`frontend/src/rendering/registry.ts`），但 `useSearch.ts` 构造 `searchConf` 时漏掉 `wholeWord`，后端 `search_matching.py` 的 `-w` 分支因此永远不执行。用户开启整词后，匹配计数与 F3/Enter 导航仍会命中 `ERROR_CODE` 这类子串行，高亮与导航不一致。
2. **find widget 的"过滤"模式是纯 UI 空转**。按钮把 `mode: 'filter'` 写入 per-tab store，但没有任何消费者读取该字段，不匹配行从未被隐藏。

这两点都违反了仓库已有规范：`per-tab-search` 要求搜索配置包含"全字"并全链路生效；`find-widget-per-panel` 明确要求过滤模式"隐藏不匹配行"。当前实现只满足了规范中"按钮显示当前模式"的场景，属于规范违反而非新需求，应尽快修复以免规范与实现持续漂移。

## What Changes

- **搜索配置全链路贯通**：`searchConf`（`sync_all` 请求体）补充 `wholeWord` 与 `mode`；后端 `search_config` 按原样接收并参与管线。
- **整词参与匹配计算**：后端 `compute_search_matches` 的 `-w` 分支恢复生效；搜索缓存键已包含 `wholeWord`，无需改键。
- **过滤模式落地**：后端在管线收敛点将"图层过滤后的可见行集"与"搜索匹配物理行集"求交，`visible_indices` 输出仅匹配行；清除搜索词/切回高亮模式后恢复图层过滤结果。
- **缓存语义保持**：图层过滤缓存仍只保存基础可见集（不含搜索过滤），搜索匹配缓存仍按查询哈希（含 `wholeWord`）保存；求交在真实计算与缓存命中两条路径上结果一致，且求交成本为 O(n) 线性合并。
- **一致性覆盖**：匹配计数、F3/Enter 导航、搜索结果面板、导出、跳转定位与行号显示在过滤模式下保持彼此一致。
- **非 BREAKING**：不改变任何 REST/WS 签名；`/api/search_ripgrep` 保留但补齐 `whole_word` 可选参数，避免遗留调用方语义不一致。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `per-tab-search`: 搜索配置中的整词选项 SHALL 参与后端匹配集、计数与导航，而不只是前端高亮。
- `find-widget-per-panel`: "过滤"模式 SHALL 真正隐藏不匹配行，而不只是切换按钮文案；清除搜索后恢复完整视图。

## Impact

- **前端**：`hooks/useSearch.ts`（searchConf 字段）、`bridge_client.ts`（`search_ripgrep` 可选参数）、`types.ts`（搜索配置类型）、`store/searchStore.ts` 无需结构变更（`mode`/`wholeWord` 已在状态中）。
- **后端**：`bridge/file_bridge.py`（`search_config` 透传、`_on_pipeline_finished` 求交、缓存读写保持基础集）、`bridge/workers.py`（如需在 worker 内合并可见集）、`bridge/search_matching.py`（`-w` 恢复生效）、`bridge/session.py`（如需保存基础可见集）。
- **API**：`/api/sync_all`、`/api/sync_layers` 的 `search_json` 增加可选字段；`/api/search_ripgrep` 增加可选 `whole_word`。均向后兼容。
- **测试**：`tests/unit/test_search_mode_parity.py`（匹配集/求交/缓存往返），`frontend/src/hooks/useSearch.test.ts`（searchConf 字段透传），e2e 补充过滤模式隐藏行与整词计数断言。
- **性能**：过滤模式在 1.3GB 日志下新增一次 O(matches + visible) 的线性求交；搜索匹配与图层过滤仍复用各自缓存，不引入额外 rg 扫描。
