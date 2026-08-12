# Spec: pywebview-icon-windows-compat

## Requirement 1: Windows 仅接受 .ico 图标

**WHEN** 平台为 Windows 且图标路径以 `.png`（或非 `.ico`）结尾
**THEN** `select_window_icon()` 返回 `None`
**AND** 打印包含 `[Main]` 前缀的提示日志

**WHEN** 平台为 Windows 且图标路径以 `.ico` 结尾且文件存在
**THEN** `select_window_icon()` 返回该路径

## Requirement 2: 非 Windows 平台接受 PNG

**WHEN** 平台非 Windows 且图标文件存在（任意扩展名）
**THEN** `select_window_icon()` 返回该路径

## Requirement 3: 路径不存在返回 None

**WHEN** 图标路径不存在（任何平台）
**THEN** `select_window_icon()` 返回 `None`
