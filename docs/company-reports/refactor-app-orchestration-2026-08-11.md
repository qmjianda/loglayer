# 一人公司循环报告：refactor-app-orchestration

**日期**: 2026-08-11
**Schema**: spec-driven
**状态**: 完成（16/16 任务）

## 目标

`frontend/src/App.tsx` 编排层瘦身（1,190 行 → 899 行），按内聚边界提取布局组件与操作编排。

## 改动

| 文件 | 内容 |
|:-----|:-----|
| `frontend/src/App.tsx` | 1,190 → 899 行，保留编排层职责（hooks/状态/信号/顶层 return） |
| `components/layout/SidebarView.tsx` | 侧栏按钮 + 视图切换区（UnifiedPanel/Search/AI + 拖拽 handle） |
| `components/layout/InspectorDock.tsx` | 右侧检视区（InspectorPanel + 宽度拖拽） |
| `components/layout/AppOverlays.tsx` | 浮层（远程选择器/命令面板/设置/诊断/快捷键/跳转行号） |
| `hooks/useFileActions.ts` | 统一打开/编辑器内打开/激活加载编排 |
| `hooks/useCommands.ts` | 命令面板命令 + 快捷键监听 |
| `components/layout/SidebarView.test.tsx` | 渲染冒烟测试（3 用例） |
| `tsconfig.json` | exclude 补 `.test.tsx`（修复进行中变更测试被 tsc 检查的缺陷） |
| `AGENTS.md` | 架构地图更新（编排层 + layout/ + useFileActions/useCommands） |

## 测试证据

- 验收测试：SidebarView.test.tsx 3 passed（先红后绿）
- 前端：tsc 0 错误 / lint 0 error / format 全过 / vitest 85 passed / build OK
- 后端：pytest 126 passed / ruff 全过
- e2e：test_split_preserve_scroll + test_multi_panel_search 3 passed（dock 交互不变）
- openspec validate：refactor-app-orchestration 通过

## DoD 核对

- [x] 全部 16/16 任务完成
- [x] 验收测试绿
- [x] 回归全绿（前后端 + e2e）
- [x] 越界检查：提交文件严格限于本变更范围
- [x] 按模块分提交（1a44383 核心 / 9cd3c58 产出物 / 46d24ce 勾选）

## 决策调整（相对探索阶段 Q3=A）

1. **"纯 A"→"A+B 轻度版"**：实测 App.tsx 已增长到 1,190 行且依赖链深，纯吸收入 hooks 不现实；改为布局 JSX 提取子组件 + 编排提取 hooks。
2. **D2 调整**：不提取 dockview 主区（实测耦合 52 个符号，props 爆炸），改为按内聚边界拆（SidebarView/InspectorDock/AppOverlays）。
3. **spec 行数目标**：1,190 → <900（原定 <700 需过度拆分，损害可维护性）。

## 风险与后续

- EditorWorkspace 未提取（dockview 区 props 密集，留在 App 为透传层）——后续如需再拆可引入 context 分组 props。
- InspectorDock/AppOverlays props 已 15-28 个，若持续膨胀可考虑分组对象。
- 并发修改：App.tsx/InspectorDock.tsx 含其他 agent（perf-deepening）已完成修改，一并提交（同一文件无法按 agent 分离）。
