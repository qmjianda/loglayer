## Why

LogLayer 的当前架构已以 FastAPI + Vite 的浏览器访问 (`--no-ui`) 为主路径，`pywebview` 仅作为薄桌面壳且带来额外系统依赖（Linux `webkit2gtk` / Windows WebView2）与打包复杂度（PyInstaller 扫描污染、冻结超时）。为降低安装与打包门槛，并为后续桌面壳的即插能力保留清晰插槽，现决定完全移除 `pywebview` 依赖，使后端成为纯本地服务，`--no-ui` 成为唯一入口。

## What Changes

- **BREAKING** 移除 `pywebview` 运行时依赖：`requirements.txt` 不再包含 `pywebview`，`pip install` 默认不安装桌面壳。
- **BREAKING** 后端启动收敛为纯服务：`backend/main.py` 移除顶部 `import webview`、`webview.create_window`/`webview.start` 分支及 `bridge.window` 注入；`--no-ui` 成为唯一启动路径，仍支持 `--host`/`--port` 与前端静态托管（`backend/www`）。
- 统一文件选择为通用接口：`backend/bridge/file_bridge.py` 移除 `webview.FileDialog` 分支，仅保留 `tkinter` 兜底与基于 `/api/list_directory` 的远程路径选择器；`has_native_dialogs` 在无壳环境下恒为 `false`。
- 保留桌面插槽：`hasNativeDialogs` / `openRemotePicker` / `bridge.window` 鸭子类型等抽象保留为通用文件选择插槽，不引入新桌面实现，便于后续 Tauri/Electron 等壳按 HTTP 契约接入。
- 清理打包与文档：`tools/package_offline.py` 不再处理 `webview` 相关钩子；`DEPLOY.md` / `README.md` 移除 `webkit2gtk` 等系统依赖说明，更新为纯服务启动方式。

## Capabilities

### New Capabilities

- `shell-file-picker-contract`: 定义与桌面壳无关的通用文件/文件夹选择契约（HTTP 端点与前端分流约定），作为移除 `pywebview` 后保留的扩展点。

### Modified Capabilities

- `remote-dialog-fallback`: 原“原生对话框不可用时回退到远程选择器”改为远程选择器即主路径，更新入口分流与语义。
- `pywebview-icon-windows-compat`: 随 `pywebview` 移除而废弃，相关窗口图标平台兼容行为不再适用（后续归档）。
- `offline-packaging-rg`: 打包说明随桌面壳移除而精简，焦点回到源码包与静态资源托管（行为不变，仅文档/脚本侧精简）。

## Impact

- 受影响代码：`backend/main.py`、`backend/bridge/file_bridge.py`、`backend/bridge/utils.py`（图标选择）、`requirements.txt`、`tools/package_offline.py`、`frontend/src/bridge_client.ts` / `hooks/useFileActions.ts` 的对话框分流。
- 受影响文档与分发：`DEPLOY.md`、`README.md`、`.github/workflows`（如涉及 webview 相关步骤）。
- 依赖与环境：移除 `pywebview` 后无需安装 `webkit2gtk` 等系统库；现有测试中覆盖远程选择器路径的用例保持通过，桌面模式相关单测需同步调整或移除。
