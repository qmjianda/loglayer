# Tasks: jump-reveal-without-centering

## 1. 验收测试（ATDD 红）

- [x] 1.1 新建 `frontend/src/utils/revealScroll.ts` 纯函数骨架：`computeRevealScrollTop(topVisibleLine, visibleRows, viewportHeight, lineHeight, targetIndex, maxLogicalScroll, maxPhysicalScroll, useScaling)` —— 返回 `{ scrollTop: number | null }`（null = 不滚动），初始实现按现有居中逻辑（1/3）占位，保证测试可编译
- [x] 1.2 新建 `frontend/src/utils/revealScroll.test.ts`，覆盖 `specs/jump-navigation/spec.md` 全部场景（视口 100~300、行高 20、视口高 4000 → visibleRows=200）：
      - 目标 150 / 101 / 299（安全区外完整可见）→ 返回 null（不滚动）
      - 目标 100（顶部安全区）/ 50（视口上方）/ 800（视口下方）→ 返回居中的物理 scrollTop（目标行位于视口正中 1/2）
      - 目标为最后一行（totalLines-1）→ 返回 clamp 后的 maxPhysicalScroll（贴底）
      - useScaling 模式（亿行压缩）下的映射换算
- [x] 1.3 运行 `npm test` 确认新测试失败（红：1/3 居中与 1/2 断言不符、无守卫导致可见目标也返回滚动值）

## 2. 实现（ATDD 绿）

- [x] 2.1 在 `frontend/src/utils/revealScroll.ts` 实现完整逻辑：
      - 可见性守卫：目标行在 `[topVisibleLine + 1, topVisibleLine + visibleRows - 1]` 内 → 返回 null
      - 居中计算：`targetLogical = max(0, targetIndex * lineHeight - viewportHeight / 2)`（1/2 正中）
      - useScaling 分支沿用现有物理/逻辑映射公式；末行依赖 scrollTo 的 clamp 贴底（不特殊处理）
- [x] 2.2 修改 `frontend/src/components/LogViewer.tsx` 的 `scrollToIndex` useEffect（约 365-373 行）与内部 Ctrl+G 的 `scrollToLine`（约 392-399 行）：改用 `computeRevealScrollTop`，返回 null 时不调用 scrollTo；其余逻辑（containerRef、behavior: 'auto'）不变
- [x] 2.3 运行 `npm test` 确认全部通过（绿：10/10）
- [x] 2.4 修复 `handleJumpToLine`（`frontend/src/hooks/useUIState.ts`）的 scrollToIndex 清空竞态：新增 `useRef` 保存清空 timer，每次跳转先 `clearTimeout` 旧 timer 再设新值（对齐 `useBookmarkLogic` 已有模式）——修复"底部循环回第一个匹配不滚动、第二个匹配才跳转"（spec: 快速连续跳转不丢失滚动信号）；验证：`npm test` 47/47 + `tsc` 通过，行为验证归入手动回归
- [x] 2.5 修复滚动看门狗拦截程序化滚动到顶：`scrollToIndex` useEffect 与 `scrollToLine` 在 `scrollTo` 后同步 `scrollStateRef.current.top`，使看门狗（`top===0 && state>0` 判定）不再把程序化滚动到顶（scrollTop=0）误判为 dockview 归零拉回旧位置（spec: 程序化滚动到顶不被滚动看门狗拦截）；验证：playwright 复现脚本确认 scrollTop 97615→0（原为不动），`npm test` + `tsc` 通过

## 3. 验证与回归

- [x] 3.1 运行 `npx tsc --noEmit` 确认类型检查通过（EXIT 0）
- [x] 3.2 手动回归清单（**用户已执行，回归通过**，含 2.4 timer 竞态与 2.5 看门狗修复验证）：
      - 搜索 next/prev（Enter/Shift+Enter）：匹配行在视口中部 → 页面不抖仅高亮移动；匹配行贴近边缘/不可见 → 居中
      - 搜索完成自动跳最近匹配：首个匹配不可见时居中显示
      - 底部循环回顶部（最后匹配 → 第一个匹配）：滚动到顶生效，不被看门狗拦截
      - F2/Shift+F2 书签跳转、侧边栏书签点击、搜索结果面板点击：遵循同一契约
      - Ctrl+G goto：视口中部行号不滚动；远处行号居中
      - 文件 watch 新内容自动滚底 / 顶部"新内容"按钮：仍贴底
      - wordWrap 开启时跳转无明显异常（安全区行级近似允许 1-2 行偏差）
- [ ] 3.3 e2e 冒烟：**用户决定不跑 e2e**（环境后端启动不稳定 + 时间成本）；核心契约已由前端单测（`revealScroll.test.ts` 10 场景）权威覆盖，此任务转为可选，环境就绪时可补 `tests/e2e/test_jump_reveal_no_center.py`（打开预加载文件 → Ctrl+G 视口内行号断言 scrollTop 不变 / 视口外行号断言滚动且目标可见）
