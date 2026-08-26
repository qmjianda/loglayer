# Fix: 打开文件夹在远程模式下缺少回退（remote fallback）

## Why

远程模式（`python backend/main.py --no-ui`，浏览器访问）下没有 pywebview 原生对话框，"打开文件夹"功能部分入口会静默失效：

- `useFileActions.handleOpen`（frontend/src/hooks/useFileActions.ts:75）已实现回退：无原生对话框时改用 `RemotePathPicker`；
- 但 **Ctrl+Shift+O 快捷键**（App.tsx 的 `onOpenFolder`，frontend/src/App.tsx:277）与**命令面板"打开文件夹"**（frontend/src/hooks/useCommands.ts:58）直接调用 `handleNativeFolderSelect()`，无任何回退——远程模式下点击后无响应；
- 根因是 `handleNativeFolderSelect`（frontend/src/hooks/useFileManagement.ts:309）的返回值语义重载：`null` 既表示"不支持原生对话框，需走远程选择器"，又表示"用户取消"，调用方无法区分，回退逻辑被迫散落在各调用点，导致遗漏。

## What Changes

- 将"原生对话框不可用时回退到 RemotePathPicker"的分流逻辑收敛进统一的打开文件夹编排，`handleNativeFolderSelect` 不再以 `null` 重载两种语义（区分"取消"与"不支持"）。
- Ctrl+Shift+O 快捷键、命令面板"打开文件夹"两个入口改走统一编排，远程模式下正常弹出 RemotePathPicker。
- 桌面模式行为不变（原生对话框；用户取消则不动作）。

## Capabilities

### New Capabilities

- `remote-dialog-fallback`: 原生文件对话框不可用（--no-ui 远程模式）时，所有打开文件/文件夹的用户入口 SHALL 自动回退到前端 RemotePathPicker，且行为与桌面模式一致（选择生效、取消无副作用）。

### Modified Capabilities

（无既有能力的需求层变化）

## Impact

- **前端**：`frontend/src/hooks/useFileActions.ts`（统一编排）、`frontend/src/hooks/useFileManagement.ts`（返回值语义）、`frontend/src/App.tsx`（快捷键接线）、`frontend/src/hooks/useCommands.ts`（命令面板）。
- **后端**：无改动（`/api/has_native_dialogs`、`/api/list_directory` 已具备）。
- **测试**：新增单测覆盖回退决策逻辑（`tests/unit/`）；e2e 可选验证 --no-ui 模式下 Ctrl+Shift+O 弹出 RemotePathPicker。
