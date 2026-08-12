# Proposal: fix-pywebview-icon-windows

## Why

GitHub issue #2：Windows 平台启动软件（pywebview 模式）即崩溃：

```
未经处理的异常: System.ArgumentException: 参数"picture"必须是可用作 Icon 的图片。
   在 System.Drawing.Icon.Initialize(Int32 width, Int32 height)
```

根因：`backend/main.py` 的 `webview.start(icon=icon_path)` 传入的是
`backend/assets/icon.png`。pywebview 在 Windows（WinForms 后端）**只接受
`.ico` 格式**的图标，传入 PNG 会触发 .NET `Icon.Initialize` 抛 ArgumentException，
导致应用启动即崩溃。

## What Changes

### 后端

1. **新增 `select_window_icon()` 纯函数**（`backend/bridge/utils.py`）
   - Windows 平台：仅当图标路径以 `.ico` 结尾且文件存在时返回该路径，
     否则返回 `None`（使用默认窗口图标）并打印提示。
   - 非 Windows 平台：文件存在即返回（GTK 等后端接受 PNG）。
   - 路径不存在一律返回 `None`。

2. **`backend/main.py` 接入**
   - `webview.start(icon=...)` 改用 `select_window_icon()` 的结果；
     `None` 时不传 `icon` 参数，避免 Windows 崩溃。

## Out of Scope

- 生成 `.ico` 文件（资产生产问题，另立变更/手工补充）。
- macOS `.icns` 特殊处理（当前无 mac 资产）。
