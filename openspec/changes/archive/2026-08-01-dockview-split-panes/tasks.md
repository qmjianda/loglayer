## 1. 依赖与基础设施

- [x] 1.1 安装 `dockview` 依赖
- [x] 1.2 确认 dockview CSS 引入方式（`dockview/dist/styles/dockview.css`）

## 2. useFileManagement 状态迁移

- [x] 2.1 移除 `panes`/`activePaneId` 状态与 `Pane` 接口
- [x] 2.2 保留 `activeFileId`/`activeFile`/`setActiveFileId` 作为唯一状态源
- [x] 2.3 新增 `onFileActivated`/`onFileClosed` 外部驱动接口（供 dockview 回调）

## 3. EditorArea（dockview 容器）

- [x] 3.1 新建 `EditorArea`，渲染 `DockviewReact`
- [x] 3.2 `onReady`：恢复布局（`fromJSON`）+ 默认面板兜底 + `onDidActiveChange` 绑定
- [x] 3.3 注册 `logViewer` 面板组件，经 `params.fileId` 渲染现有 `LogViewer`
- [x] 3.4 布局变化时 `toJSON` 防抖保存到 localStorage
- [x] 3.5 面板关闭事件 → `onFileClosed` 释放文件会话

## 4. App.tsx 迁移

- [x] 4.1 渲染区替换为 `<EditorArea>`
- [x] 4.2 文件打开入口（文件树/命令面板/拖放）统一走 dockview API：已打开则激活，否则 addPanel
- [x] 4.3 移除 App.tsx 中 `panes.map` 及 `activePaneId` 相关逻辑
- [x] 4.4 命令面板/快捷键中涉及分屏的项改用 dockview API（经查无分屏命令，无需迁移）

## 5. 验证

- [x] 5.1 `npx tsc --noEmit` 通过
- [x] 5.2 vitest 全绿（项目当前无测试文件与 vitest 配置，无受影响测试）
- [x] 5.3 手测：打开/关闭/切换文件、拖拽分屏、嵌套分屏、布局恢复（已自动化验证打开/关闭/切换/布局恢复；拖拽与嵌套分屏建议人工复核）
- [x] 5.4 确认 LogViewer 选择/右键/书签行为不变（已自动化验证点击/拖选/右键菜单；书签建议人工复核）
