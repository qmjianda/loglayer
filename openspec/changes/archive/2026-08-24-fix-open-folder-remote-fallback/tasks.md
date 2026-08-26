# Tasks: fix-open-folder-remote-fallback

## 1. 验收测试（ATDD 先红）

- [x] 1.1 编写单测：统一编排 `handleOpenFolder` 在 `hasNativeDialogs()==false` 时调用远程选择器、为 true 时走原生选择（mock bridge，`tests/unit/` 或前端 vitest）
- [x] 1.2 编写单测：取消路径无副作用——原生取消返回 null 不设工作区，远程关闭不设工作区
- [x] 1.3 运行验收测试确认全部失败（红）

## 2. 核心实现

- [x] 2.1 useFileManagement：`handleNativeFolderSelect` 移除内部 `hasNativeDialogs()` 分流，语义收敛为"原生选择，未选中返回 null"
- [x] 2.2 useFileActions：将 `handleOpen` 收敛为统一的 `handleOpenFolder`（原生/远程分流 + isDir/文件结果处理）
- [x] 2.3 App.tsx：`onOpenFolder`（Ctrl+Shift+O）改调 `handleOpenFolder`
- [x] 2.4 useCommands.ts：命令面板 `file.openFolder` action 改调 `handleOpenFolder`

## 3. 验证与收尾

- [x] 3.1 验收测试转绿；`npx tsc --noEmit` 与 `npm run lint` 通过
- [x] 3.2 确认 design Open Question（Ctrl+O 打开文件入口路径）并在变更记录中注明结论
- [x] 3.3 手动验证 --no-ui 模式：快捷键/命令面板打开文件夹弹出 RemotePathPicker（无法自动化时给出手动步骤）
