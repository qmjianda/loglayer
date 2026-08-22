# fix-ctrl-g-duplicate-widget 任务

## 1. 验收测试（先红后绿）

- [x] 1.1 e2e：按下 Ctrl+G 断言页面只有一个"跳转到行"输入框
- [x] 1.2 e2e：滚动到文件中部按 Ctrl+G，断言 scrollTop 不变、跳转框可见
- [x] 1.3 e2e：跳转框已打开时再按 Ctrl+G，断言仍只有一个输入框且输入框获得焦点

## 2. 核心实现

- [x] 2.1 删除 LogViewer.tsx 的 Ctrl+G keydown 分支、`showGoToLine` state 与内嵌 `<EditorGoToLineWidget>` JSX 及 import
- [x] 2.2 确认/调整 AppOverlays 中跳转框容器为视口锚定（fixed 或 portal），确保不处于任何滚动容器内容流内
- [x] 2.3 EditorGoToLineWidget 输入框 focus 改为 `focus({ preventScroll: true })` 兜底
- [x] 2.4 useUIState Ctrl+G 增加幂等守卫：已打开时通过 focusRequest 计数让既有输入框重新聚焦，不新建实例

## 3. 验证与收尾

- [x] 3.1 运行 1.1–1.3 验收测试转绿
- [x] 3.2 `npx tsc --noEmit` + `npm run lint` + `npm run format:check` 通过
- [ ] 3.3 手动回归：Enter 跳转定位正确、Escape 关闭、多面板分屏下行为正常
