# logviewer-architecture-revamp

## Why

当前架构中搜索、过滤、渲染三条逻辑绑死在单一管线里，且搜索状态为全局单例：改一个搜索词就要重跑整条 `syncAll` 管线并重建渲染缓存；切换 Tab 时搜索词/导航位置互相串扰；视觉计算（高亮、行样式）由后端逐行烧进渲染缓存，无法支持 per-tab 独立高亮。同时图层协议没有明确的"执行位置"概念，添加新图层（尤其是视觉类图层）摩擦大。这套架构限制了交互向 VSCode 对齐、也拖累了大型日志（1.3GB）下的搜索/渲染性能。

## What Changes

- **数据/视觉分层**：过滤（FILTERING）与转换（TRANSFORM）留在后端高性能执行；渲染（RENDERING）与搜索高亮全部迁移到前端，后端 `rendering_cache` 只存纯文本内容，删除后端逐行 `highlight_line`/`get_row_style`/搜索正则计算。
- **图层协议 v2**：图层类别即执行位置（`engine`），后端 registry 对渲染层只保留元数据（type/display_name/ui_schema）；前端引入渲染器注册表 + 通用规则引擎（配置即图层）。**BREAKING**：不再兼容旧插件协议（`DataProcessingLayer` 合并类、`discover_plugins` 旧机制退役）。
- **搜索/过滤管线解耦**：搜索匹配从 `PipelineWorker` 拆为独立计算，改为请求时（F3/Enter 导航时）计算 + 结果缓存；PipelineWorker 支持取消/replace（新任务取代旧任务）。
- **计算结果缓存**：按 `(file_hash, layers_hash)` 缓存过滤结果、`(file_hash, query_hash)` 缓存搜索匹配（存物理行号，不存视觉索引）；热数据内存 LRU、冷数据 SQLite（复用 chunk+zlib 模式）。内存 LRU 改用成熟库（cachetools）。
- **per-tab 搜索状态**：搜索词、配置、导航位置（rank）以面板为单位独立（`Map<panelId, TabState>`），与 dockview 面板生命周期绑定；后端搜索保持 per-file 权威 + 前端 per-tab 快照。
- **交互对齐 VSCode**：当前匹配/其他匹配异色、跳转居中 reveal、无结果红框提示、Esc 两段式（先收 widget 再清词）、可选侧边栏结果列表（Search View）。
- **可观测性**：后端管线阶段计时与缓存命中统计、前端 per-tab 状态快照 Debug overlay，关键点可观察、方便 Debug。
- **少自研**：虚拟滚动/多 Tab 布局/搜索内核沿用或评估成熟方案（dockview、ripgrep、TanStack Virtual 评估、zustand、cmdk）。

## Capabilities

### New Capabilities
- `layer-system-v2`: 图层协议 v2 —— 类别即执行位置（engine 路由）、渲染层前端化、前端渲染器注册表与通用规则引擎、可扩展的图层添加路径
- `per-tab-search`: 每个 Tab（面板）独立的搜索词/配置/导航状态，与 dockview 生命周期绑定
- `search-and-pipeline-cache`: 过滤结果与搜索匹配的分层缓存（内存 LRU + SQLite），缓存 key 化与失效策略
- `observability`: 管线阶段计时、缓存命中统计、per-tab 状态快照与诊断输出

### Modified Capabilities
- `log-viewer-rendering`: 视觉渲染（搜索高亮、渲染层、书签样式）从后端逐行计算迁移到前端可见行渲染
- `index-metadata-cache`: 缓存能力从行偏移索引扩展到过滤/搜索计算结果（沿用 chunk+zlib 与 LRU 模式）

## Impact

- **后端**：`bridge.py`（PipelineWorker 拆分、rendering 逐行计算删除、缓存接入）、`search_mixin.py`（搜索改存物理行号）、`main.py`（新增搜索/缓存端点）、`loglayer/core.py`（图层类别/engine）、`loglayer/registry.py`（渲染层仅元数据）、`loglayer/builtin/`（渲染层类退化）、`loglayer/metadata_cache.py`（表扩展）。
- **前端**：`App.tsx`、`hooks/useSearch.ts`、`hooks/useUIState.ts`、`components/EditorArea.tsx`（panelId 传递）、`LogViewer.tsx`/`LogRow.tsx`（前端高亮接入）、`EditorFindWidget.tsx`/`SearchPanel.tsx`（交互对齐）、`bridge_client.ts`（新 API）。
- **依赖**：新增 `cachetools`；评估 `zustand`、`cmdk`、TanStack Virtual（前端）。
- **破坏性变更**：图层插件协议不兼容、渲染缓存格式变化、搜索 API 语义调整（搜索独立于 syncAll）。
- **测试**：新增缓存命中/失效、渲染器快照、per-tab 状态机、搜索解耦单测；1.3GB 大文件性能门禁（打开/搜索/滚动/F3 跳转）。
