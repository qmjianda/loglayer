# LogLayer UI 文档索引

> 界面布局文档入口

---

## 文档列表

| 文档 | 内容 | 何时阅读 |
|:-----|:-----|:---------|
| [MAIN.md](MAIN.md) | 主窗口布局 | 了解整体结构 |
| [SIDEBAR.md](SIDEBAR.md) | 侧边栏面板 | 开发侧边栏功能 |
| [MODALS.md](MODALS.md) | 浮动面板 | 开发弹窗/悬浮框 |

---

## 截图原图

位于 `docs/assets/*.png`:
- `工作区.png` - 工作区面板
- `AI助手.png` - AI助手面板
- `统计.png` - 统计面板
- `设置.png` - 设置面板
- `快捷键.png` - 快捷键面板
- `搜索悬浮框.png` - 搜索框
- `跳转悬浮框.png` - 跳转行框
- `帮助.png` - 帮助面板

---

## 组件总览

| 组件 | 位置 | 文件 |
|:-----|:-----|:-----|
| 主布局 | App.tsx | 状态编排 |
| 日志查看器 | components/LogViewer.tsx | Canvas 渲染 |
| 侧边栏 | components/Sidebar*.tsx | 图标+面板 |
| 状态栏 | components/StatusBar.tsx | 底部信息 |
| 设置 | components/SettingsPanel.tsx | 6选项卡 |
| AI助手 | components/AIChatPanel.tsx | 聊天界面 |
| 搜索框 | components/EditorFindWidget.tsx | Ctrl+F |
| 跳转行 | components/EditorGoToLineWidget.tsx | Ctrl+G |
| 命令面板 | components/CommandPalette.tsx | Ctrl+Shift+P |

*2026-03-14*
