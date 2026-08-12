# pywebview-icon-windows-compat 能力规范

## Purpose

定义桌面窗口图标选择的平台兼容行为：Windows 仅接受 `.ico` 图标、非 Windows 平台接受任意扩展名、路径不存在时返回 `None`，避免因图标格式不兼容导致窗口创建失败。

## Requirements

### Requirement: Windows 仅接受 .ico 图标

系统 SHALL 在 Windows 平台仅接受 `.ico` 扩展名的图标路径，非 `.ico` 路径返回 `None` 并打印提示日志。

#### Scenario: 非 ico 路径被拒绝

- **WHEN** 平台为 Windows 且图标路径以 `.png`（或非 `.ico`）结尾
- **THEN** `select_window_icon()` 返回 `None`
- **AND** 打印包含 `[Main]` 前缀的提示日志

#### Scenario: ico 路径被接受

- **WHEN** 平台为 Windows 且图标路径以 `.ico` 结尾且文件存在
- **THEN** `select_window_icon()` 返回该路径

### Requirement: 非 Windows 平台接受 PNG

系统 SHALL 在非 Windows 平台接受任意扩展名的图标文件。

#### Scenario: 任意扩展名可用

- **WHEN** 平台非 Windows 且图标文件存在（任意扩展名）
- **THEN** `select_window_icon()` 返回该路径

### Requirement: 路径不存在返回 None

系统 SHALL 在图标路径不存在时（任何平台）返回 `None`。

#### Scenario: 缺失图标路径

- **WHEN** 图标路径不存在（任何平台）
- **THEN** `select_window_icon()` 返回 `None`
