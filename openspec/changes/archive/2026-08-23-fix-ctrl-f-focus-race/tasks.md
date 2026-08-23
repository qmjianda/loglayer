# fix-ctrl-f-focus-race 任务

## 1. 验收测试（先红后绿）

- [x] 1.1 e2e（`test_per_tab_find_widget.py` 增补场景）：分屏两面板，分别在两个面板上点击后按 Ctrl+F，断言各自 find widget 打开且 `document.activeElement` 为该面板搜索输入框
- [x] 1.2 组件/e2e 补充断言：LogViewerPanel 以 dockview panel id 读写 per-tab 搜索状态（由 1.1 历史布局场景覆盖：params 无 panelId 时行为一致；不为此导出内部组件）

## 2. 核心实现（净删为主）

- [x] 2.1 `EditorArea.tsx` LogViewerPanel：`const panelId = api.id`（替换 `params.panelId ?? ''`）
- [x] 2.2 `LogViewerPanelParams` 接口删除 `panelId` 字段；3 处 `addPanel` 调用点删除 `params.panelId` 写入
- [x] 2.3 useUIState Ctrl+F 分支注释显式化"不受 isInput 守卫限制是有意行为"

## 3. 清理与验证

- [x] 3.1 删除探针：`frontend/src/utils/probe.ts` 及 searchStore/useUIState/EditorArea/EditorFindWidget 中全部 `[Probe:*]` 调用与 import
- [x] 3.2 运行 1.1–1.2 验收测试转绿 + 既有 searchStore/EditorFindWidget/useUIState 测试无回归
- [x] 3.3 `npx tsc --noEmit` + `npm run lint` + `npm run format:check` 通过
- [x] 3.4 手动回归：分屏两面板 Ctrl+F 目标正确、Esc 收起后再 Ctrl+F 可恢复、F3/Shift+F3 导航正常、状态栏匹配计数正常显示
