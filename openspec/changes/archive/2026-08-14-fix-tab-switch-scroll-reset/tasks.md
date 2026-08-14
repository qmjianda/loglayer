# Tasks: fix-tab-switch-scroll-reset

## 1. 验收测试（ATDD）

- [x] 1.1 更新 `tests/e2e/test_split_preserve_scroll.py` 的 docstring：修复机制从「滚动位置看门狗逐帧拉回」改为「dockview `always` 渲染策略原生保持滚动位置」。
- [x] 1.2 在 `test_split_preserve_scroll.py` 中补充「拖拽移动面板后内容仍显示」断言（覆盖 `always` 的 dockview move 坑场景）。
- [x] 1.3 运行 `python3 -m pytest tests/e2e/test_split_preserve_scroll.py -v` 确认验收测试绿（1 passed，稳定）。

## 2. 实现（移除看门狗）

- [x] 2.1 确认 `frontend/src/components/EditorArea.tsx` 保留 `defaultRenderer="always"`。
- [x] 2.2 移除 `frontend/src/components/LogViewer.tsx` 的滚动位置看门狗 `useEffect`（rAF 逐帧检测 + 拉回）。
- [x] 2.3 移除为防看门狗误判而同步 `scrollStateRef` 的配套逻辑（`onScroll` / `scrollToIndex` / `scrollToLine` / 文件切换恢复 reassert）；`LOGVIEWER_SCROLL_STORE` 读写保留。

## 3. 测试适配（always 的 DOM 结构变化）

- [x] 3.1 `helpers.wait_for_log_canvas` 改用 `.log-row:visible`。
- [x] 3.2 `test_split_preserve_scroll.py` 定位逻辑：`always` 下面板内容位于 shell 层 overlay（不在 `.dv-groupview` 内），改用全局 `[data-logviewer]` + DOM 顺序 index 定位。
- [x] 3.3 适配其他多面板 e2e 测试（`test_multi_panel_search.py`、`test_per_tab_find_widget.py`）：find input / mark / 行文本的全局查询加 `:visible` 限定；「B 的 find 不应自动打开」等即时 count 断言改为 `wait_for_function`（A 失活后 find 隐藏有异步延迟，避免竞态）。

## 4. 验证与回归

- [x] 4.1 `npx tsc --noEmit`（EXIT 0）+ `npm run lint`（error=0）+ `npx vitest run`（11 文件 79 用例全绿）。`npm run format:check` 仅 pre-existing 的 bridge_client.ts 格式问题（非本次改动引入）。
- [x] 4.2 `test_split_preserve_scroll.py`（滚动位置保持验收）+ `test_multi_panel_search.py` + `test_per_tab_find_widget.py` 均绿（多面板适配后 5 passed × 2 次稳定）。
- [x] 4.3 完整 e2e light 回归：27 passed / 1 failed。唯一失败 `test_multi_panel_search_independence` 在 `test_large_file_rendering` 之后运行——**已用 git stash 对比原始代码（onlyWhenVisible）确认同序同样失败，属 pre-existing 测试隔离问题**（大文件测试拖累 backend/vite 服务），与本次变更无关；该测试单独运行稳定通过。
- [x] 4.4 手动回归：普通切 tab、分屏切 tab（滚动位置保持）、拖拽移动面板（内容显示）、关闭文件（正常释放）。（用户已在真实环境确认：归零 BUG 已修复、无其他问题）
