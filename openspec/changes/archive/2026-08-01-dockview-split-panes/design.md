## Context

当前分屏为自研实现：`useFileManagement` 持有 `panes: Pane[]`（扁平数组，仅 `{id, fileId}`）+ `activePaneId`，App.tsx 用 `panes.map` 渲染 flex 布局。缺陷：无拖拽分屏、无嵌套、无分割线调整、无布局持久化，activeFile 由 `activePaneId` 派生。loglayer_ps 已验证 dockview 方案（拖拽、嵌套、布局序列化、面板 params、`onDidActiveChange` 驱动激活）。

## Goals / Non-Goals

**Goals:**
- 用 dockview 完全替换自研分屏
- 保留现有 `LogViewer` 组件与其全部交互
- 迁移 `activeFileId` 驱动方式，最小化 App.tsx 其他逻辑改动
- 布局持久化到 localStorage

**Non-Goals:**
- 不重写 LogViewer 渲染/交互
- 不引入 scroll-sync（本次只做分屏替换，scroll-sync 作为后续独立变更）
- 不改动后端、bridge_client、图层/书签/搜索状态

## Decisions

### Decision 1: activeFileId 由 dockview 驱动，但状态仍留在 useFileManagement

`useFileManagement` 保留 `activeFileId`/`activeFile`/`setActiveFileId` 作为唯一状态源，但**移除内部 `panes` 状态**。dockview 的 `onDidActiveChange` 通过回调把激活面板的 fileId 传给 `setActiveFileId`。这样 App.tsx 中所有依赖 `activeFileId` 的逻辑（侧边栏、状态栏、搜索、书签）零改动。

备选（activeFileId 移到 App 层）被否——会牵动大量依赖，违背"最小改动"。

### Decision 2: 新建 EditorArea 作为 dockview 容器

`EditorArea` 组件接收 `files`、`onFileActivated`、`onFileClosed` 回调，内部持有 `DockviewApi`：
- `onReady`：恢复布局（`fromJSON`），失败则添加默认面板；注册 `onDidActiveChange` → 更新激活 fileId
- 面板组件 `logViewer`：经 `params.fileId` 渲染现有 `LogViewer`
- 布局变化时 `toJSON` 防抖保存到 localStorage

### Decision 3: 打开文件的入口统一走 dockview API

文件树点击、命令面板打开、拖放统一收敛为 `openFileInEditor(fileId)`：若该 fileId 已有面板则激活，否则 `addPanel`。避免多处各自维护"是否已打开"。

### Decision 4: 移除 useFileManagement 的 panes，保留文件列表

`panes`/`activePaneId` 从 `useFileManagement` 移除；`files`/`setFiles`/`addNewFiles` 等文件列表逻辑保留。文件关闭由 dockview 面板关闭事件驱动 `onFileClosed` → 释放会话。

### Decision 5: dockview 主题适配

沿用 dockview 默认 CSS（`dockview/dist/styles/dockview.css`），主题色后续再与当前 Tailwind 主题对齐（非本次范围）。

## Risks / Trade-offs

- [activeFileId 驱动变更引入激活状态 bug] → 保持 useFileManagement 为唯一状态源，dockview 仅经回调写入，避免双写
- [布局恢复失效] → `fromJSON` 包 try/catch，失败回退默认面板
- [面板关闭与文件会话释放竞态] → `onFileClosed` 幂等，重复关闭不报错
- [LogViewer 在 dockview 面板内尺寸计算] → 面板容器 100% 高，LogViewer 用 ResizeObserver（现有实现已支持）

## Migration Plan

1. 安装 `dockview` 依赖
2. `useFileManagement`：移除 panes/activePaneId；暴露 `activeFileId` + `setActiveFileId` + `openFileInEditor`（暂由 App 持有 dockview API）
3. 新建 `EditorArea`（dockview 容器 + 面板组件）
4. App.tsx 渲染区替换为 EditorArea；迁移文件打开/激活/关闭入口
5. 迁移命令面板/快捷键（分屏命令改 dockview API）
6. 全量回归（打开/关闭/切换文件、分屏、布局恢复）

## Open Questions

- 命令面板当前的分屏命令（Ctrl+\ 等）是否存在于本版本？——经查，本版本命令面板无分屏命令，无需迁移
- dockview 是否需要 `@dockview/` 样式覆盖当前主题？——列为后续优化
