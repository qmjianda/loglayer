# LogLayer 系统架构全景图

> 本文档使用 Mermaid 图表清晰描述 LogLayer 项目的完整架构，帮助首次接触代码的开发者快速理解系统结构。
> **注意**: 本文档已更新以反映 OOP 重构后的新架构（2026-03）

---

## 目录

1. [系统总览](#1-系统总览)
2. [技术栈分层](#2-技术栈分层)
3. [后端架构](#3-后端架构)
4. [前端架构](#4-前端架构)
5. [图层系统核心](#5-图层系统核心)
6. [数据流与交互](#6-数据流与交互)
7. [类型同步机制](#7-类型同步机制)
8. [模块交互总览](#8-模块交互总览)

---

## 1. 系统总览

### 1.1 产品定位

**LogLayer** - 高性能日志分析桌面应用，支持 GB 级日志文件的毫秒级搜索和可视化过滤。

| 维度 | 描述 |
|:-----|:-----|
| **产品形态** | 桌面应用 (pywebview + FastAPI) |
| **目标用户** | 开发工程师、运维人员、SRE |
| **核心场景** | 大型日志文件分析、错误追踪、性能优化 |
| **竞争优势** | mmap 索引、Canvas 虚拟滚动、多引擎搜索 |

### 1.2 系统架构总览图

```mermaid
graph TB
    subgraph "桌面壳层"
        PYWEBVIEW[pywebview<br/>跨平台原生窗口]
    end
    
    subgraph "后端 Python"
        FASTAPI[FastAPI 服务器<br/>:12345]
        BRIDGE[FileBridge<br/>核心协调器]
        WORKERS[ThreadPoolExecutor<br/>后台工作线程池]
        LAYER_ENGINE[Layer Engine<br/>图层处理引擎]
        MMAP[mmap<br/>内存映射文件]
        RIPGREP[ripgrep<br/>原生搜索引擎]
    end
    
    subgraph "前端 React"
        APP[App.tsx<br/>根组件]
        HOOKS[Custom Hooks<br/>状态管理层]
        BRIDGE_CLIENT[bridge_client.ts<br/>通信层]
        COMPONENTS[UI Components<br/>Canvas/面板/弹窗]
    end
    
    subgraph "数据持久化"
        STORAGE[.loglayer/<br/>会话配置/书签]
    end
    
    PYWEBVIEW -->|加载| APP
    APP <-->|REST API| FASTAPI
    APP <-->|WebSocket| FASTAPI
    FASTAPI --> BRIDGE
    BRIDGE --> WORKERS
    BRIDGE --> LAYER_ENGINE
    BRIDGE --> MMAP
    LAYER_ENGINE --> RIPGREP
    BRIDGE --> STORAGE
    
    HOOKS --> BRIDGE_CLIENT
    COMPONENTS --> HOOKS
```

---

## 2. 技术栈分层

### 2.1 技术栈概览

```mermaid
graph LR
    subgraph "前端层"
        A1[React 19]
        A2[TypeScript]
        A3[Vite]
        A4[Tailwind CSS 4]
        A5[HTML5 Canvas]
    end
    
    subgraph "后端层"
        B1[Python 3.10+]
        B2[FastAPI]
        B3[uvicorn]
        B4[WebSockets]
        B5[Pydantic]
    end
    
    subgraph "桌面层"
        C1[pywebview]
    end
    
    subgraph "系统层"
        D1[mmap]
        D2[ripgrep]
        D3[ThreadPoolExecutor]
    end
    
    subgraph "构建/测试"
        E1[pytest]
        E2[Vitest]
        E3[Playwright]
        E4[PyInstaller]
    end
```

### 2.2 目录结构

```mermaid
graph TB
    subgraph "项目根目录"
        ROOT[loglayer/]
    end
    
    subgraph "后端代码"
        BACKEND[backend/]
        B_MAIN[main.py<br/>FastAPI 入口]
        B_BRIDGE[bridge.py<br/>核心协调器]
        B_WORKERS[workers.py<br/>后台线程]
        B_LOGLAYER[loglayer/<br/>图层引擎]
        B_BUILTIN[layers/builtin/<br/>内置图层]
    end
    
    subgraph "前端代码"
        FRONTEND[frontend/]
        F_SRC[src/]
        F_APP[App.tsx<br/>根组件]
        F_HOOKS[hooks/<br/>状态管理]
        F_COMP[components/<br/>UI 组件]
        F_BRIDGE[bridge_client.ts<br/>通信层]
        F_CTX[contexts/<br/>React Contexts]
    end
    
    subgraph "文档与测试"
        DOCS[docs/]
        TESTS[tests/]
        TOOLS[tools/]
    end
    
    ROOT --> BACKEND
    ROOT --> FRONTEND
    ROOT --> DOCS
    ROOT --> TESTS
    ROOT --> TOOLS
    
    BACKEND --> B_MAIN
    BACKEND --> B_BRIDGE
    BACKEND --> B_WORKERS
    BACKEND --> B_LOGLAYER
    B_LOGLAYER --> B_BUILTIN
    
    FRONTEND --> F_SRC
    F_SRC --> F_APP
    F_SRC --> F_HOOKS
    F_SRC --> F_COMP
    F_SRC --> F_BRIDGE
    F_SRC --> F_CTX
```

---

## 3. 后端架构

### 3.1 模块依赖关系（重构后）

```mermaid
graph TB
    subgraph "入口层"
        MAIN[main.py<br/>FastAPI 应用]
        WS_MGR[websocket_manager.py<br/>WebSocket 管理]
    end
    
    subgraph "核心层 - FileBridge"
        BRIDGE[bridge.py<br/>FileBridge]
    end
    
    subgraph "OOP 组件层（组合模式）"
        SESSION_MGR[session_manager.py<br/>会话生命周期]
        CACHE_MGR[cache_manager.py<br/>LRU+TTL 缓存]
        WORKER_REG[worker_registry.py<br/>工作线程注册]
    end
    
    subgraph "Delegator 组合层"
        SEARCH_DEL[search_delegator.py<br/>搜索操作]
        BOOKMARK_DEL[bookmark_delegator.py<br/>书签操作]
        PIPELINE_DEL[layer_pipeline_delegator.py<br/>图层流水线]
    end
    
    subgraph "图层引擎"
        CORE[loglayer/core.py<br/>图层基类]
        REGISTRY[loglayer/registry.py<br/>图层注册表]
        SCHEMAS[loglayer/schemas.py<br/>数据模型]
        UI[loglayer/ui.py<br/>UI 配置]
        STORAGE[loglayer/storage.py<br/>存储抽象]
        PATTERN[loglayer/pattern_detector.py<br/>模式检测]
        EXPORT[loglayer/export.py<br/>导出功能]
    end
    
    subgraph "内置图层"
        FILTER[filter.py]
        HIGHLIGHT[highlight.py]
        LEVEL[level.py]
        QUERY[query.py]
        REPLACE[replace.py]
        RANGE[range.py]
        TIME[time_filter.py]
        LABEL[label.py]
        ROWTINT[rowtint.py]
    end
    
    MAIN --> BRIDGE
    MAIN --> WS_MGR
    WS_MGR --> BRIDGE
    
    BRIDGE --> SESSION_MGR
    BRIDGE --> CACHE_MGR
    BRIDGE --> WORKER_REG
    BRIDGE --> SEARCH_DEL
    BRIDGE --> BOOKMARK_DEL
    BRIDGE --> PIPELINE_DEL
    
    SESSION_MGR --> CORE
    CACHE_MGR --> CORE
    WORKER_REG --> CORE
    
    PIPELINE_DEL --> CORE
    PIPELINE_DEL --> REGISTRY
    
    REGISTRY --> CORE
    REGISTRY --> FILTER
    REGISTRY --> HIGHLIGHT
    REGISTRY --> LEVEL
    REGISTRY --> QUERY
    REGISTRY --> REPLACE
    REGISTRY --> RANGE
    REGISTRY --> TIME
    REGISTRY --> LABEL
    REGISTRY --> ROWTINT
    
    CORE --> SCHEMAS
    CORE --> UI
```

### 3.2 OOP 重构说明

| 重构前（Mixin 继承） | 重构后（组合模式） |
|:---------------------|:-------------------|
| `FileBridge --|> SearchPipeline` | `SearchDelegator` 通过构造函数注入依赖 |
| `FileBridge --|> BookmarkPipeline` | `BookmarkDelegator` 组合到 FileBridge |
| `FileBridge --|> LayerPipelineMixin` | `LayerPipelineDelegator` 负责流水线 |
| 内部状态分散在 FileBridge | 新增 `SessionManager`, `CacheManager`, `WorkerRegistry` |

### 3.3 API 端点分类

```mermaid
graph TB
    subgraph "FastAPI 端点 - main.py"
        API[REST API :12345/api/*]
        WS[WebSocket :12345/ws]
    end
    
    subgraph "文件操作"
        F1[POST /open_file]
        F2[POST /close_file]
        F3[GET /select_files]
        F4[GET /select_folder]
        F5[GET /list_directory]
        F6[GET /file_info]
    end
    
    subgraph "图层/流水线"
        L1[POST /sync_all]
        L2[POST /sync_layers]
        L3[POST /sync_decorations]
        L4[GET /read_processed_lines]
        L5[POST /get_lines_by_indices]
    end
    
    subgraph "搜索操作"
        S1[POST /search_ripgrep]
        S2[GET /get_search_match_index]
        S3[GET /is_search_match]
        S4[GET /get_nearest_search_rank]
        S5[GET /get_next_search_match]
        S6[GET /get_search_matches_range]
    end
    
    subgraph "书签操作"
        B1[POST /toggle_bookmark]
        B2[GET /get_bookmarks]
        B3[GET /get_nearest_bookmark_index]
        B4[POST /clear_bookmarks]
        B5[POST /update_bookmark_comment]
    end
    
    subgraph "工作区"
        W1[POST /save_workspace_config]
        W2[GET /load_workspace_config]
        W3[GET /list_logs_in_folder]
    end
    
    subgraph "分析/导出"
        A1[GET /log_level_stats]
        A2[GET /analyze_log_pattern]
        A3[GET /suggest_layers]
        A4[POST /export_logs]
    end
    
    subgraph "系统"
        SYS1[GET /platform]
        SYS2[GET /has_native_dialogs]
        SYS3[GET /worker_config]
        SYS4[POST /worker_config]
        SYS5[GET /system_metrics]
        SYS6[GET /physical_to_visual_index]
    end
    
    subgraph "插件/挂件"
        P1[GET /get_layer_registry]
        P2[GET /get_ui_widgets]
        P3[GET /get_widget_data]
        P4[POST /reload_plugins]
    end
    
    API --> F1 & F2 & F3 & F4 & F5 & F6
    API --> L1 & L2 & L3 & L4 & L5
    API --> S1 & S2 & S3 & S4 & S5 & S6
    API --> B1 & B2 & B3 & B4 & B5
    API --> W1 & W2 & W3
    API --> A1 & A2 & A3 & A4
    API --> SYS1 & SYS2 & SYS3 & SYS4 & SYS5 & SYS6
    API --> P1 & P2 & P3 & P4
```

### 3.4 FileBridge 核心类（重构后）

```mermaid
classDiagram
    class FileBridge {
        -Dict~str, LogSession~ _sessions
        -LayerRegistry _registry
        -ThreadPoolExecutor executor
        -SessionManager session_manager
        -CacheManager cache_manager
        -WorkerRegistry worker_registry
        -SearchDelegator search_delegator
        -BookmarkDelegator bookmark_delegator
        -LayerPipelineDelegator layer_pipeline_delegator
        +fileLoaded: Signal
        +pipelineFinished: Signal
        +statsFinished: Signal
        +open_file(file_id, path) bool
        +close_file(file_id)
        +sync_layers(file_id, layers_json)
        +read_processed_lines(file_id, start, count) str
        +search_ripgrep(file_id, query, regex, case_sensitive)
        +get_layer_registry() str
        +_ensure_delegators()
    }
    
    class SessionManager {
        +create_session(file_id, path) LogSession
        +get_session(file_id) LogSession
        +close_session(file_id)
        +sessions: Dict~str, LogSession~
    }
    
    class CacheManager {
        +create_rendering_cache() RenderingCache
        +get_stats(config_hash) Optional~Dict~
        +put_stats(config_hash, stats)
        +invalidate_stats(config_hash)
    }
    
    class WorkerRegistry {
        +register_worker(file_id, worker)
        +unregister_worker(file_id)
        +get_worker(file_id, type) Optional~Worker~
    }
    
    class SearchDelegator {
        -_get_session: Callable
        -_pipeline_finished: Optional~Callable~
        +get_search_match_index(file_id, rank) int
        +is_search_match(file_id, index) bool
        +get_search_rank_for_index(file_id, index) int
    }
    
    class BookmarkDelegator {
        -_get_session: Callable
        +toggle_bookmark(file_id, line_index) Dict
        +get_bookmarks(file_id) Dict
    }
    
    class LayerPipelineDelegator {
        -_get_session: Callable
        -_registry: LayerRegistry
        -_worker_registry: WorkerRegistry
        +sync_layers(file_id, layers_json) bool
        +sync_decorations(file_id, layers_json) bool
    }
    
    class LogSession {
        +str id
        +str path
        +mmap mmap
        +array line_offsets
        +array visible_indices
        +array search_matches
        +List layer_instances
        +List rendering_instances
        +LRUCache rendering_cache
        +Dict bookmarks
        +close()
    }
    
    FileBridge --> SessionManager
    FileBridge --> CacheManager
    FileBridge --> WorkerRegistry
    FileBridge --> SearchDelegator
    FileBridge --> BookmarkDelegator
    FileBridge --> LayerPipelineDelegator
    FileBridge --> LogSession : manages
```

### 3.5 后台工作线程

```mermaid
classDiagram
    class CustomThread {
        <<abstract>>
        -bool _running
        -bool _cancelled
        +start()
        +stop()
        +wait()
        +cancel()
        +run()* 
    }
    
    class IndexingWorker {
        -mmap mmap
        -int size
        -str file_path
        +Signal finished(object)
        +Signal progress(float)
        +Signal error(str)
        +FAST_PREVIEW_BYTES: 10MB
        +MAX_OFFSETS_SIZE: 50M
        +SPARSE_INTERVAL: 100
        +run()
    }
    
    class PipelineWorker {
        -str rg_path
        -str file_path
        -List layers
        -Dict search_config
        +Signal finished(indices, matches)
        +Signal progress(float)
        +Signal error(str)
        +run()
    }
    
    class StatsWorker {
        -str rg_path
        -List layers
        -str file_path
        -int total_lines
        +Signal finished(stats_json)
        +Signal error(str)
        +run()
    }
    
    CustomThread <|-- IndexingWorker
    CustomThread <|-- PipelineWorker
    CustomThread <|-- StatsWorker
```

---

## 4. 前端架构

### 4.1 组件层级结构

```mermaid
graph TB
    subgraph "根组件"
        APP[App.tsx]
    end
    
    subgraph "Provider 层"
        SETTINGS[SettingsProvider]
        SHORTCUTS[ShortcutProvider]
    end
    
    subgraph "布局层"
        HEADER[AppHeader]
        SIDEBAR[Sidebar<br/>活动栏]
        SIDEBAR_PANEL[SidebarContainer<br/>可调整宽度]
        MAIN[MainContent<br/>可分割面板]
    end
    
    subgraph "侧边栏内容"
        UNIFIED[UnifiedPanel]
        FILE_TREE[FileTree<br/>文件浏览器]
        LAYERS_PANEL[LayersPanel<br/>图层管理]
        PRESETS[Presets<br/>预设配置]
    end
    
    subgraph "主内容区"
        PANE_GROUP[PaneGroup<br/>react-resizable-panels]
        PANE1[LogViewerPane 1]
        PANE2[LogViewerPane 2]
        TABBAR[TabBar<br/>文件标签]
        LOGVIEWER[LogViewer<br/>Canvas 渲染]
    end
    
    subgraph "浮动组件"
        FIND[EditorFindWidget<br/>Ctrl+F]
        GOTOLINE[EditorGoToLineWidget<br/>Ctrl+G]
    end
    
    subgraph "弹窗层"
        MODALS[AppModals]
        CMD_PALETTE[CommandPalette]
        SETTINGS_PANEL[SettingsPanel]
        EXPORT[ExportDialog]
        PLUGIN[PluginManager]
    end
    
    APP --> SETTINGS
    SETTINGS --> SHORTCUTS
    SHORTCUTS --> HEADER
    SHORTCUTS --> SIDEBAR
    SHORTCUTS --> SIDEBAR_PANEL
    SHORTCUTS --> MAIN
    
    SIDEBAR_PANEL --> UNIFIED
    UNIFIED --> FILE_TREE
    UNIFIED --> LAYERS_PANEL
    UNIFIED --> PRESETS
    
    MAIN --> PANE_GROUP
    PANE_GROUP --> PANE1
    PANE_GROUP --> PANE2
    
    PANE1 --> TABBAR
    PANE1 --> LOGVIEWER
    PANE1 --> FIND
    PANE1 --> GOTOLINE
    
    APP --> MODALS
    MODALS --> CMD_PALETTE
    MODALS --> SETTINGS_PANEL
    MODALS --> EXPORT
    MODALS --> PLUGIN
```

### 4.2 状态管理：Hooks 组合模式

> **注意**: 文档早期版本曾描述 WorkspaceContext Provider，但当前实现使用 **Hooks 组合模式** 替代了 Context Provider。状态通过 `useFileManagement` 和 `usePaneManagement` 管理，通过 props 传递到子组件。

**核心概念**：
- `activeFileId` 是 **Pane（面板）级别** 的属性，不是全局状态
- 每个 Pane 维护自己的 `openFileIds[]` 和 `activeFileId`
- 支持多窗口分割，每个窗口独立跟踪激活文件

```mermaid
classDiagram
    class useFileManagement {
        +files: FileData[]
        +panes: Pane[]
        +activePaneId: string | null
        +setFiles()
        +setPanes()
        +setActivePaneId()
    }
    
    class usePaneManagement {
        +splitPane()
        +removePane()
    }
    
    class FileData {
        +string id
        +string name
        +number size
        +number lineCount
        +number rawCount
        +LogLayer[] layers
        +Record~number, string~ bookmarks
        +boolean isBridged
        +string path?
    }
    
    class Pane {
        +string id
        +string[] openFileIds        // 该面板中打开的文件列表
        +string activeFileId         // ⚡ 当前激活的文件（标签页切换用）
        +string direction?           // 分割方向
        +Pane[] children?            // 嵌套分割
        +boolean findVisible
        +string searchQuery?
        +number searchMatchCount?
    }
    
    useFileManagement --> FileData
    useFileManagement --> Pane
    usePaneManagement ..> useFileManagement : uses panes
```

**activeFileId 的作用**：
1. **标签页切换**：用户点击不同标签时，更新当前 Pane 的 `activeFileId`
2. **状态隔离**：搜索、过滤、书签等状态按 `activeFileId` 隔离存储
3. **UI 显示**：状态栏、行号等信息来自当前 `activeFileId` 对应的文件

### 4.3 自定义 Hooks 依赖图

```mermaid
graph TB
    subgraph "通信层"
        BRIDGE[useBridge<br/>WebSocket + REST 信号监听]
    end
    
    subgraph "文件管理"
        FILE_MGMT[useFileManagement<br/>文件 CRUD + 面板状态]
        PANE_MGMT[usePaneManagement<br/>分割面板操作]
    end
    
    subgraph "图层管理"
        LAYER_REG[useLayerRegistry<br/>获取图层类型]
        LAYER_MGMT[useLayerManagement<br/>图层 CRUD + 撤销重做]
    end
    
    subgraph "搜索"
        SEARCH[useSearch<br/>搜索状态 + ripgrep]
    end
    
    subgraph "UI 状态"
        UI_STATE[useUIState<br/>UI 状态管理]
        SETTINGS[useSettings<br/>设置 Context]
    end
    
    subgraph "书签"
        BOOKMARKS[useBookmarks<br/>书签数据]
        BOOKMARK_LOGIC[useBookmarkLogic<br/>书签导航]
    end
    
    subgraph "工作区"
        WORKSPACE[useWorkspaceConfig<br/>自动保存工作区]
        PLATFORM[usePlatformInfo<br/>平台检测]
    end
    
    subgraph "其他"
        VIRTUAL_SCROLL[useVirtualScroll<br/>虚拟滚动计算]
        SHORTCUTS[useKeyboardShortcuts<br/>快捷键处理]
        METRICS[useSystemMetrics<br/>系统指标]
    end
    
    BRIDGE --> FILE_MGMT
    BRIDGE --> SEARCH
    BRIDGE --> BOOKMARKS
    BRIDGE --> WORKSPACE
    BRIDGE --> PLATFORM
    BRIDGE --> LAYER_REG
    
    FILE_MGMT --> PANE_MGMT
    FILE_MGMT --> LAYER_MGMT
    
    LAYER_REG --> LAYER_MGMT
    LAYER_MGMT --> SEARCH
    
    BOOKMARKS --> BOOKMARK_LOGIC
    
    UI_STATE --> SHORTCUTS
```

### 4.4 状态管理架构

```mermaid
graph TB
    subgraph "Context Providers"
        SETTINGS_CTX[SettingsContext<br/>21 个设置项]
        SHORTCUT_CTX[ShortcutContext<br/>快捷键映射]
        WORKSPACE_CTX[WorkspaceContext<br/>新增 - 文件/面板状态]
    end
    
    subgraph "文件状态 - useFileManagement"
        FILES_STATE[files: FileData[]<br/>打开的文件列表]
        PANES_STATE[panes: Pane[]<br/>分割面板树]
        ACTIVE_PANE[activePaneId<br/>当前聚焦面板]
        INDEXING[indexingFileIds: Set<br/>加载中文件]
    end
    
    subgraph "图层状态 - useLayerManagement"
        LAYERS_STATE[layers: LogLayer[]<br/>当前文件图层]
        UNDO_REDO[past/future: LogLayer[][]<br/>撤销重做历史]
        PRESETS_STATE[presets: LayerPreset[]<br/>保存的预设]
    end
    
    subgraph "搜索状态 - useSearch"
        QUERY[searchQuery: string]
        CONFIG[searchConfig: {regex, caseSensitive}]
        RANK[currentMatchRank: number]
        HISTORY[searchHistory: string[]]
    end
    
    subgraph "UI 状态 - useUIState"
        VIEW[activeView: main/help]
        WIDTH[sidebarWidth: number]
        SCROLL[scrollToIndex: number?]
        PROCESSING[isProcessing: boolean]
    end
    
    SETTINGS_CTX --> WORKSPACE_CTX
    WORKSPACE_CTX --> FILES_STATE
    FILES_STATE --> LAYERS_STATE
    FILES_STATE --> PANES_STATE
    LAYERS_STATE --> SEARCH
    UI_STATE --> VIEW
```

### 4.5 Bridge Client 通信架构

```mermaid
sequenceDiagram
    participant FE as Frontend (React)
    participant BC as bridge_client.ts
    participant WS as WebSocket
    participant API as FastAPI REST
    participant BE as Backend (Python)
    
    Note over FE,BC: 初始化
    FE->>BC: ensureBridge()
    BC->>WS: new WebSocket(ws://host/ws)
    WS-->>BC: onopen → connected
    
    Note over FE,BE: 文件操作
    FE->>BC: open_file(fileId, path)
    BC->>API: POST /api/open_file
    API->>BE: bridge.open_file()
    BE->>BE: IndexingWorker.start()
    BE->>WS: broadcast_signal("fileLoaded")
    WS-->>BC: onmessage → fileLoaded.emit()
    BC-->>FE: callback(fileId, payload)
    
    Note over FE,BE: 图层同步
    FE->>BC: sync_layers(fileId, layers)
    BC->>API: POST /api/sync_layers
    API->>BE: bridge.sync_layers()
    BE->>BE: LayerPipelineDelegator.sync_layers()
    BE->>BE: PipelineWorker.start()
    BE->>WS: broadcast_signal("pipelineFinished")
    WS-->>BC: onmessage → pipelineFinished.emit()
    BC-->>FE: callback(fileId, newTotal, matchCount)
    
    Note over FE,BE: 虚拟滚动
    FE->>BC: read_processed_lines(fileId, start, count)
    BC->>API: GET /api/read_processed_lines?...
    API->>BE: bridge.read_processed_lines()
    BE-->>API: JSON LogLine[]
    API-->>BC: Response
    BC-->>FE: Promise<LogLine[]>
```

---

## 5. 图层系统核心

### 5.1 图层类继承层次

```mermaid
classDiagram
    class Layer {
        <<abstract>>
        +str type_id
        +str display_name
        +LayerCategory category
        +LayerStage stage
        +List inputs
        +Dict config
        +process(context) LayerResult*
        +get_ui_schema() List
        +_bind_config()
    }
    
    class FilterLayer {
        +LayerCategory FILTER
        +LayerStage LOGIC
        +filter_line(content, index) bool
        +process(context) LayerResult
    }
    
    class NativeFilterLayer {
        +LayerStage NATIVE
        +get_rg_args() List~str~
    }
    
    class TransformLayer {
        +LayerCategory TRANSFORM
        +LayerStage LOGIC
        +transform_line(content) str
        +process_line(content) ProcessedLine
    }
    
    class HighlightLayer {
        +LayerCategory HIGHLIGHT
        +LayerStage RENDERING
        +highlight_line(content) List~Highlight~
    }
    
    class DecorationLayer {
        +LayerCategory DECORATION
        +LayerStage RENDERING
        +get_row_style(content, index) RowStyle
    }
    
    class Widget {
        +LayerCategory WIDGET
        +LayerStage RENDERING
        +str role
        +float refresh_interval
        +get_data() Dict
    }
    
    Layer <|-- FilterLayer
    FilterLayer <|-- NativeFilterLayer
    Layer <|-- TransformLayer
    Layer <|-- HighlightLayer
    Layer <|-- DecorationLayer
    Layer <|-- Widget
```

### 5.2 三阶段流水线

```mermaid
flowchart LR
    subgraph STAGE1["阶段 1: NATIVE"]
        direction TB
        N1[ripgrep 命令 1]
        N2[ripgrep 命令 2]
        N3[ripgrep 命令 3]
        N1 -->|"|"| N2
        N2 -->|"|"| N3
    end
    
    subgraph STAGE2["阶段 2: LOGIC"]
        direction TB
        L1[FilterLayer<br/>filter_line]
        L2[TransformLayer<br/>transform_line]
        L3[QueryLayer<br/>filter_line]
        L1 --> L2
        L2 --> L3
    end
    
    subgraph STAGE3["阶段 3: RENDERING"]
        direction TB
        R1[HighlightLayer<br/>highlight_line]
        R2[DecorationLayer<br/>get_row_style]
        R1 --> R2
    end
    
    RAW[原始日志行] --> STAGE1
    STAGE1 -->|"visible_indices"| STAGE2
    STAGE2 -->|"filtered_indices"| STAGE3
    STAGE3 -->|"LogLine[]"| DISPLAY[Canvas 渲染]
    
    style STAGE1 fill:#e1f5fe
    style STAGE2 fill:#fff3e0
    style STAGE3 fill:#e8f5e9
```

### 5.3 五类别功能分类

```mermaid
mindmap
  root((Layer<br/>Category))
    FILTER
      行级可见性
      返回: bool
      ::icon(fa fa-filter)
      FilterLayer
      LevelLayer
      QueryLayer
      RangeLayer
      TimeFilterLayer
      LabelLayer
    TRANSFORM
      内容修改
      返回: str
      ::icon(fa fa-exchange-alt)
      ReplaceLayer
      LabelTransformLayer
    HIGHLIGHT
      文本级高亮
      返回: List[Highlight]
      ::icon(fa fa-highlighter)
      HighlightLayer
    DECORATION
      行级样式
      返回: RowStyle
      ::icon(fa fa-palette)
      RowTintLayer
    WIDGET
      独立 UI 组件
      返回: Dict
      ::icon(fa fa-chart-bar)
      TimelineHistogram
      StatsPanel
```

### 5.4 内置图层实现

```mermaid
graph TB
    subgraph "FILTER 类别"
        FILTER_IMPL[FilterLayer<br/>ripgrep 文本过滤]
        LEVEL_IMPL[LevelLayer<br/>日志级别过滤]
        QUERY_IMPL[QueryLayer<br/>KQL 查询语言]
        RANGE_IMPL[RangeLayer<br/>行号范围]
        TIME_IMPL[TimeFilterLayer<br/>时间戳过滤]
        LABEL_IMPL[LabelLayer<br/>Loki 标签过滤]
    end
    
    subgraph "TRANSFORM 类别"
        REPLACE_IMPL[ReplaceLayer<br/>正则替换]
        LABEL_T_IMPL[LabelTransformLayer<br/>标签标注]
    end
    
    subgraph "HIGHLIGHT 类别"
        HIGHLIGHT_IMPL[HighlightLayer<br/>文本高亮]
    end
    
    subgraph "DECORATION 类别"
        ROWTINT_IMPL[RowTintLayer<br/>行背景着色]
    end
    
    subgraph "渲染层调用"
        RENDER[read_processed_lines]
    end
    
    FILTER_IMPL --> RENDER
    LEVEL_IMPL --> RENDER
    QUERY_IMPL --> RENDER
    RANGE_IMPL --> RENDER
    TIME_IMPL --> RENDER
    LABEL_IMPL --> RENDER
    REPLACE_IMPL --> RENDER
    LABEL_T_IMPL --> RENDER
    HIGHLIGHT_IMPL --> RENDER
    ROWTINT_IMPL --> RENDER
```

### 5.5 LayerRegistry 注册表

```mermaid
flowchart TB
    subgraph "发现阶段"
        DISCOVER[discover_plugins]
        SCAN_BUILTIN[扫描 layers/builtin/]
        SCAN_PLUGINS[扫描 plugins/]
    end
    
    subgraph "注册表"
        REGISTRY[LayerRegistry]
        BUILTIN_MAP[builtin_layers<br/>Dict type_id → Class]
        PLUGIN_MAP[plugin_layers<br/>Dict type_id → Class]
        WIDGET_MAP[plugin_widgets<br/>Dict type_id → Class]
    end
    
    subgraph "实例化"
        CREATE[create_layer_instance]
        CONFIG[绑定 config]
        INSTANCE[Layer 实例]
    end
    
    DISCOVER --> SCAN_BUILTIN
    DISCOVER --> SCAN_PLUGINS
    SCAN_BUILTIN --> BUILTIN_MAP
    SCAN_PLUGINS --> PLUGIN_MAP
    SCAN_PLUGINS --> WIDGET_MAP
    
    BUILTIN_MAP --> REGISTRY
    PLUGIN_MAP --> REGISTRY
    WIDGET_MAP --> REGISTRY
    
    REGISTRY --> CREATE
    CREATE --> CONFIG
    CONFIG --> INSTANCE
```

---

## 6. 数据流与交互

### 6.1 文件打开流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as Frontend
    participant BC as bridge_client
    participant API as FastAPI
    participant BR as FileBridge
    participant IW as IndexingWorker
    participant WS as WebSocket
    
    U->>FE: 点击打开文件
    FE->>BC: open_file(fileId, path)
    BC->>API: POST /api/open_file
    API->>BR: bridge.open_file()
    
    BR->>BR: SessionManager.create_session()
    BR->>BR: mmap 映射文件
    BR->>IW: 启动 IndexingWorker
    
    par 快速预览阶段
        IW->>IW: 扫描前 10MB
        IW->>BR: finished(partial: true)
        BR->>WS: fileLoaded(partial)
        WS->>FE: fileLoaded 信号
        FE->>FE: 显示预览内容
    and 完整索引阶段
        IW->>IW: 扫描剩余内容
        IW->>BR: finished(offsets)
        BR->>WS: fileLoaded(complete)
        WS->>FE: fileLoaded 信号
        FE->>FE: 更新行数
    end
```

### 6.2 虚拟滚动数据流

```mermaid
sequenceDiagram
    participant U as 用户滚动
    participant LV as LogViewer
    participant VS as useVirtualScroll
    participant BC as bridge_client
    participant API as FastAPI
    participant BR as FileBridge
    participant CACHE as LRUCache
    participant MM as mmap
    
    U->>LV: 滚动事件
    LV->>VS: 计算可见范围
    VS->>VS: startLine, endLine
    VS->>BC: read_processed_lines(fileId, start, count)
    BC->>API: GET /api/read_processed_lines
    
    API->>BR: bridge.read_processed_lines()
    
    loop 每行
        BR->>CACHE: 检查缓存
        alt 缓存命中
            CACHE-->>BR: 返回缓存数据
        else 缓存未命中
            BR->>MM: 读取 mmap[start:end]
            BR->>BR: 应用 Transform 图层
            BR->>BR: 应用 Highlight 图层
            BR->>BR: 应用 Decoration 图层
            BR->>BR: 应用搜索高亮
            BR->>CACHE: 写入缓存
        end
    end
    
    BR-->>API: JSON LogLine[]
    API-->>BC: Response
    BC-->>LV: LogLine[]
    LV->>LV: Canvas 渲染
```

### 6.3 图层同步流程（重构后）

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as Frontend
    participant BC as bridge_client
    participant API as FastAPI
    participant BR as FileBridge
    participant DELEGATOR[LayerPipelineDelegator]
    participant PW as PipelineWorker
    participant SW as StatsWorker
    participant WS as WebSocket
    
    U->>FE: 修改图层配置
    FE->>BC: sync_layers(fileId, layers)
    BC->>API: POST /api/sync_layers
    API->>BR: bridge.sync_layers()
    
    BR->>DELEGATOR: sync_layers(file_id, layers_json)
    DELEGATOR->>DELEGATOR: 解析 layers JSON
    DELEGATOR->>DELEGATOR: 创建图层实例
    DELEGATOR->>DELEGATOR: 分离 layer/rendering instances
    DELEGATOR->>PW: 启动 PipelineWorker
    
    PW->>PW: 构建 ripgrep 命令链
    PW->>PW: 执行 NATIVE 阶段
    PW->>PW: 执行 LOGIC 阶段
    PW->>DELEGATOR: finished(indices, matches)
    
    DELEGATOR->>WS: pipelineFinished 信号
    WS->>FE: 更新 visible_indices
    
    DELEGATOR->>SW: 启动 StatsWorker
    SW->>SW: 并行计算图层统计
    SW->>DELEGATOR: finished(stats)
    DELEGATOR->>WS: statsFinished 信号
    WS->>FE: 更新图层统计
```

### 6.4 WebSocket 信号流

```mermaid
flowchart LR
    subgraph "Backend Signals"
        S1[fileLoaded]
        S2[pipelineFinished]
        S3[statsFinished]
        S4[operationStarted]
        S5[operationProgress]
        S6[operationError]
        S7[pendingFilesCount]
    end
    
    subgraph "WebSocket"
        WS[WebSocket连接<br/>ws://host/ws]
    end
    
    subgraph "Frontend Signals"
        F1[fileLoaded.emit]
        F2[pipelineFinished.emit]
        F3[statsFinished.emit]
        F4[operationStarted.emit]
        F5[operationProgress.emit]
        F6[operationError.emit]
        F7[pendingFilesCount.emit]
    end
    
    subgraph "Hook Callbacks"
        CB1[useBridge<br/>onFileLoaded]
        CB2[useBridge<br/>onPipelineFinished]
        CB3[useBridge<br/>onStatsFinished]
    end
    
    S1 --> WS --> F1 --> CB1
    S2 --> WS --> F2 --> CB2
    S3 --> WS --> F3 --> CB3
    S4 --> WS --> F4
    S5 --> WS --> F5
    S6 --> WS --> F6
    S7 --> WS --> F7
```

---

## 7. 类型同步机制

### 7.1 前后端类型映射

```mermaid
graph LR
    subgraph "Python Backend"
        P1[schemas.py<br/>Pydantic Models]
        P2[LayerTypeEnum]
        P3[LogLayer]
        P4[LayerConfig]
        P5[LogLine]
        P6[Highlight]
        P7[RowStyle]
    end
    
    subgraph "TypeScript Frontend"
        T1[types.ts<br/>Interfaces]
        T2[LayerType enum]
        T3[LogLayer interface]
        T4[LayerConfig interface]
        T5[LogLine interface]
        T6[Highlight inline]
        T7[RowStyle interface]
    end
    
    P2 <-->|"Mirror"| T2
    P3 <-->|"Mirror"| T3
    P4 <-->|"Mirror"| T4
    P5 <-->|"Mirror"| T5
    P6 <-->|"Mirror"| T6
    P7 <-->|"Mirror"| T7
```

### 7.2 命名约定转换

```mermaid
flowchart TB
    subgraph "Frontend camelCase"
        F1[fileId]
        F2[lineIndex]
        F3[caseSensitive]
        F4[startRank]
        F5[folderPath]
    end
    
    subgraph "bridge_client.ts 转换"
        CONV[自动转换]
    end
    
    subgraph "Backend snake_case"
        B1[file_id]
        B2[line_index]
        B3[case_sensitive]
        B4[start_rank]
        B5[folder_path]
    end
    
    F1 --> CONV --> B1
    F2 --> CONV --> B2
    F3 --> CONV --> B3
    F4 --> CONV --> B4
    F5 --> CONV --> B5
```

### 7.3 核心数据结构

```mermaid
classDiagram
    class LogLayer {
        +string id
        +string name
        +LayerType type
        +boolean enabled
        +boolean isLocked?
        +boolean isCollapsed?
        +string groupId?
        +LayerConfig config
    }
    
    class LayerConfig {
        +string query?
        +boolean regex?
        +boolean caseSensitive?
        +boolean wholeWord?
        +boolean invert?
        +string[] levels?
        +string color?
        +float opacity?
        +... (extra fields)
    }
    
    class LogLine {
        +number index
        +string content
        +string displayContent?
        +Highlight[] highlights?
        +boolean isMarked?
        +string bookmarkComment?
        +RowStyle rowStyle?
    }
    
    class Highlight {
        +number start
        +number end
        +string color
        +float opacity
        +boolean isSearch?
    }
    
    class RowStyle {
        +string backgroundColor?
        +string color?
    }
    
    class FileData {
        +string id
        +string name
        +number size
        +number lineCount
        +number rawCount
        +LogLayer[] layers
        +History history
    }
    
    class Pane {
        +string id
        +string[] openFileIds
        +string activeFileId?
        +string direction?
        +Pane[] children?
    }
    
    LogLayer --> LayerConfig
    LogLine --> Highlight
    LogLine --> RowStyle
    FileData --> LogLayer
```

---

## 8. 模块交互总览

### 8.1 完整系统交互图

```mermaid
flowchart TB
    subgraph "用户界面层"
        UI[React Components]
        HOOKS[Custom Hooks]
    end
    
    subgraph "通信层"
        BRIDGE_CLIENT[bridge_client.ts]
        REST[REST API]
        WS[WebSocket]
    end
    
    subgraph "后端服务层"
        FASTAPI[FastAPI Server]
        FILEBRIDGE[FileBridge]
        REGISTRY[LayerRegistry]
    end
    
    subgraph "OOP 组件层（新增）"
        SESSION_MGR[SessionManager]
        CACHE_MGR[CacheManager]
        WORKER_REG[WorkerRegistry]
    end
    
    subgraph "Delegator 层（新增）"
        SEARCH_DEL[SearchDelegator]
        BOOKMARK_DEL[BookmarkDelegator]
        PIPELINE_DEL[LayerPipelineDelegator]
    end
    
    subgraph "处理引擎层"
        WORKERS[ThreadPoolExecutor]
        INDEXING[IndexingWorker]
        PIPELINE[PipelineWorker]
        STATS[StatsWorker]
    end
    
    subgraph "图层处理层"
        NATIVE[NATIVE Stage<br/>ripgrep]
        LOGIC[LOGIC Stage<br/>Python]
        RENDERING[RENDERING Stage<br/>按需调用]
    end
    
    subgraph "数据访问层"
        MMAP[mmap<br/>内存映射]
        STORAGE[.loglayer/<br/>持久化]
        CACHE[LRUCache<br/>渲染缓存]
    end
    
    UI --> HOOKS
    HOOKS --> BRIDGE_CLIENT
    BRIDGE_CLIENT --> REST
    BRIDGE_CLIENT --> WS
    
    REST --> FASTAPI
    WS --> FASTAPI
    FASTAPI --> FILEBRIDGE
    FILEBRIDGE --> REGISTRY
    FILEBRIDGE --> SESSION_MGR
    FILEBRIDGE --> CACHE_MGR
    FILEBRIDGE --> WORKER_REG
    FILEBRIDGE --> SEARCH_DEL
    FILEBRIDGE --> BOOKMARK_DEL
    FILEBRIDGE --> PIPELINE_DEL
    
    SESSION_MGR --> WORKERS
    WORKER_REG --> WORKERS
    
    WORKERS --> INDEXING
    WORKERS --> PIPELINE
    WORKERS --> STATS
    
    PIPELINE_DEL --> NATIVE
    PIPELINE_DEL --> LOGIC
    FILEBRIDGE --> RENDERING
    
    INDEXING --> MMAP
    PIPELINE --> MMAP
    RENDERING --> MMAP
    RENDERING --> CACHE
    
    FILEBRIDGE --> STORAGE
```

### 8.2 关键设计决策

| 决策 | 选择 | 原因 |
|:-----|:-----|:-----|
| 通信协议 | REST + WebSocket | REST 用于按需数据获取，WebSocket 用于实时信号 |
| 大文件处理 | mmap + 虚拟滚动 | 支持 GB 级文件，O(1) 内存占用 |
| 搜索引擎 | ripgrep | 原生多线程，比 grep 快 10-100 倍 |
| 图层流水线 | 3 阶段分离 | NATIVE 最快，LOGIC 灵活，RENDERING 按需 |
| 状态管理 | 纯 Hooks + Context | 避免 Redux 复杂性，保持代码简洁 |
| 类型同步 | 手动 Mirror 注释 | 灵活可控，适合中小型项目 |
| OOP 重构 | 组合 > 继承 | 消除 Mixin 依赖，更清晰的责任分离 |
| 新增组件 | WorkspaceContext | 统一管理文件/面板状态，避免 prop drilling |

---

## 附录：快速导航

| 想了解... | 请阅读 |
|:----------|:-------|
| 后端 API 端点 | [第 3.3 节](#33-api-端点分类) |
| 前端组件层级 | [第 4.1 节](#41-组件层级结构) |
| OOP 重构说明 | [第 3.2 节](#32-oop-重构说明) |
| 新增 WorkspaceContext | [第 4.2 节](#42-新增workspacecontext) |
| 图层类继承 | [第 5.1 节](#51-图层类继承层次) |
| 三阶段流水线 | [第 5.2 节](#52-三阶段流水线) |
| 文件打开流程 | [第 6.1 节](#61-文件打开流程) |
| 虚拟滚动原理 | [第 6.2 节](#62-虚拟滚动数据流) |
| 类型同步约定 | [第 7.2 节](#72-命名约定转换) |

---

*文档生成时间: 2026-03-28*
*基于 LogLayer 项目 OOP 重构后架构分析*
