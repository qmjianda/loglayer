# Tasks: fix-wheel-scroll-scaling

## 1. 验收测试（ATDD 红）

- [x] 1.1 纯函数单测（vitest）：`wheelDeltaToLogicalPx(deltaY, deltaMode, lineHeight, viewportHeight)`，覆盖 deltaMode 0/1/2 三分支。
- [x] 1.2 运行 `npx vitest run` 确认失败（红）。

## 2. 滚轮归一化（log-viewer-rendering）

- [x] 2.1 `frontend/src/utils/wheelDelta.ts` 新增 `wheelDeltaToLogicalPx` 纯函数。
- [x] 2.2 `LogViewer.tsx` 在 `useScaling` 启用时对滚动容器加 `wheel` 监听（`passive:false`）：preventDefault → 归一化 → 逻辑转物理 → 设置 scrollTop（仅处理 deltaY，不碰 deltaX）。

## 3. 验证与回归

- [x] 3.1 `npx tsc --noEmit` + `npm run lint` + `npx vitest run`（13 文件 90 测试）全绿。
- [x] 3.2 heavy e2e 回归：新增 `test_wheel_scroll_scaling.py`（超大文件滚轮 deltaY=100 → 物理 scrollTop 移动 <30px，未放大）通过。
- [x] 3.3 回归验证：heavy e2e 已证滚轮不放大（客观部分）；主观「手感」留给用户实测，若每格 5 行偏快可调灵敏度。
