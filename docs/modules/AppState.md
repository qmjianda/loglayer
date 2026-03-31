# AppState Module

> 状态管理架构 - LogLayer 的状态流和 Hooks 组织

---

## 概述

LogLayer 采用 **Hook 分离架构**，将复杂的业务逻辑分发到各个 custom hooks 中。`App.tsx` 作为协调层，管理所有状态并传递给子组件。

---

## 状态分类

| 类别 | 存储 | 示例 |
|------|------|------|
| **UI 状态** | React state | `activeView`, `sidebarOpen`, `modals` |
| **持久状态** | localStorage | `settings`, `presets`, `searchHistory` |
| **缓存状态** | Backend + Frontend | `processedCache`, `logLevelStats` |

---

## Hooks 架构

```
App.tsx
├── useSettings()          # 用户设置 (持久化)
├── useFileManagement()    # 文件列表、激活文件
├── useLayerManagement()   # 图层 CRUD、撤销重做
├── usePaneManagement()    # 分屏管理、搜索状态
├── useBridge()            # 后端信号监听
├── useBookmarks()         # 书签管理
├── useFileWatch()         # 文件变化监控
├── useAppModals()        # 弹窗状态
└── useSystemMetrics()     # 系统资源监控
```

---

## 核心状态流

### 文件状态流

```
用户打开文件
    ↓
useFileManagement.openFile()
    ↓
fileBridge.open_file() → Backend
    ↓
fileLoaded signal → useBridge
    ↓
update files state
    ↓
LogViewer re-renders
```

### 图层状态流

```
用户添加/修改图层
    ↓
useLayerManagement.addLayer()
    ↓
sync_layers() → Backend
    ↓
pipelineFinished signal
    ↓
update processedCache
    ↓
LogViewer re-renders with new highlights
```

### 搜索状态流

```
用户输入搜索
    ↓
EditorFindWidget.onQueryChange()
    ↓
更新 Pane.searchQuery
    ↓
search_ripgrep() → Backend
    ↓
更新 searchMatchCount (存储在 Pane)
    ↓
用户按 F3 导航
    ↓
getNextSearchMatch()
```

> **注意**: 搜索状态已集成到 `usePaneManagement` 中，每个 Pane 独立管理自己的搜索状态

---

## 关键 Hooks 详解

### useFileManagement

**职责**: 管理文件列表、文件操作（不涉及 Pane）

```typescript
interface UseFileManagementReturn {
  // 文件状态
  files: FileData[];
  
  // 加载状态
  indexingFileIds: Set<string>;
  pendingCliFiles: number;
  
  // 缓存
  processedCache: Record<string, ProcessedCache>;
  bridgedUpdateTrigger: number;
  
  // 文件操作
  setActiveFileId: (fileId: string | null) => void;
  handleFileActivate: (fileId: string) => void;
  handleFileRemove: (fileId: string) => void;
  addNewFiles: (files: any[], autoActivateFirst?: boolean) => void;
  handleNativeFileSelect: () => Promise<void>;
  handleNativeFolderSelect: () => Promise<{ path: string; name: string } | null>;
  handleOpenFileByPath: (path: string, name: string) => void;
  markFileLoaded: (fileId: string) => void;
}
```

> **注意**: Pane 状态已移至 `usePaneManagement`

### usePaneManagement

**职责**: 管理分屏操作（分割、删除 Pane）

```typescript
interface UsePaneManagementReturn {
  splitPane: (
    sourcePaneId: string, 
    fileId?: string, 
    position?: 'left' | 'right' | 'top' | 'bottom'
  ) => void;
  removePane: (paneId: string) => void;
}

// Pane 接口定义
interface Pane {
  id: string;
  openFileIds: string[];
  activeFileId: string | null;
  direction?: 'horizontal' | 'vertical';
  children?: Pane[];
  findVisible?: boolean;
  goToLineVisible?: boolean;
  searchQuery?: string;
  searchConfig?: { regex: boolean; caseSensitive: boolean };
  scrollToIndex?: number | null;
  searchMatchCount?: number;
  currentMatchRank?: number;
}
```

### useLayerManagement

**职责**: 图层 CRUD 和撤销重做

```typescript
interface UseLayerManagementReturn {
  layers: LogLayer[];
  addLayer: (type: LayerType, config?: LayerConfig) => void;
  updateLayer: (id: string, updates: Partial<LogLayer>) => void;
  removeLayer: (id: string) => void;
  undo: () => void;
  redo: () => void;
}
```

### useBridge

**职责**: 监听后端信号，同步数据

```typescript
// 信号处理
fileLoaded → 更新文件信息
pipelineFinished → 更新行数、匹配数
statsFinished → 更新统计
operationError → 显示错误
```

---

## 状态所有权规则

1. **单一来源**: 每个状态只在一个 hook 中管理
2. **向下传递**: 状态通过 props 传递给子组件
3. **向上回调**: 子组件通过回调函数更新状态
4. **避免重复**: 不在多个地方存储相同数据

---

## 常见问题

### Q: 为什么不用 Context/Redux?

**A**: LogLayer 的状态是局部的，不需要全局访问。Hook 分离架构足够清晰，避免额外复杂度。

### Q: processedCache 为什么在 useFileManagement?

**A**: 它是文件相关的派生状态，与文件生命周期绑定。

---

## 相关文件

- `frontend/src/App.tsx` - 状态协调
- `frontend/src/hooks/useFileManagement.ts` - 文件状态 + Pane 引用
- `frontend/src/hooks/usePaneManagement.ts` - Pane 接口 + 分屏操作 + 搜索状态
- `frontend/src/hooks/useLayerManagement.ts`
- `frontend/src/hooks/useBridge.ts`