## REMOVED Requirements

### Requirement: Windows 仅接受 .ico 图标

**Reason**: pywebview 桌面壳被完全移除，窗口图标选择逻辑失去调用方；后续桌面壳（Tauri/Electron）各自管理图标格式兼容。
**Migration**: 未来接入新桌面壳时，由该壳的配置体系（如 Tauri `icons/`、Electron `icon` 选项）直接承载图标，不再经由后端工具函数选择。

### Requirement: 非 Windows 平台接受 PNG

**Reason**: 同上，随 pywebview 壳移除，该平台兼容行为无适用场景。
**Migration**: 由未来桌面壳自身的图标规范承载。

### Requirement: 路径不存在返回 None

**Reason**: 同上，`select_window_icon` 仅服务于 pywebview 窗口创建，随壳移除而废弃。
**Migration**: 若未来需要服务端图标路径校验，在新壳契约中重新定义。
