# Tasks: fix-filter-scroll-stuck

## 0. 协调（与 fix-scroll-empty-screen 同改 LogViewer.tsx）

- [x] 0.1 确认 fix-scroll-empty-screen 对 `LogViewer.tsx` 的改动已提交/落地（已合并 7b06949 / 24c1585），本变更在其后实现，无 git 冲突

## 1. 验收测试（ATDD 红）

- [x] 1.1 新增 e2e `tests/e2e/test_filter_scroll_reset.py`：打开多行日志 → 滚到中部 → 加过滤图层（大幅减少行数）→ 断言 `scrollTop` 归零、`scrollHeight` 收敛到新内容高、视口显示首行（非空白）
- [x] 1.2 运行 `python3 -m pytest tests/e2e/test_filter_scroll_reset.py -v` 确认失败（红：`scrollTop 未归零: 4025`）

## 2. 实现（ruler 移出滚动容器）

- [x] 2.1 `LogViewer.tsx`：return 外层新增 `relative` 包裹层（`flex-1 min-w-0 min-h-0`），滚动容器改 `h-full w-full` 并保持 `containerRef`
- [x] 2.2 `LogViewer.tsx`：Overview Ruler 移到包裹层内、滚动容器外（兄弟节点），`absolute right-0 top-0`，删除 `transform: translateY(scrollTop)`
- [x] 2.3 确认 ruler 视觉不变：固定视口顶部、分布/书签/拇指指示器位置正确（内部渲染逻辑未改，仅定位容器由滚动容器改为非滚动包裹层）

## 3. 验证与回归

- [x] 3.1 `python3 -m pytest tests/e2e/test_filter_scroll_reset.py -v`（绿）+ `test_split_preserve_scroll.py`（切 tab 滚动保持）通过
- [x] 3.2 `npx tsc --noEmit`（EXIT 0）+ `npm run lint`（error=0）+ `npx vitest run`（90/90 绿）
- [x] 3.3 手动回归：大文件滚动、ruler 显示、加过滤（滚动条归零）、切 tab 滚动位置保持（用户自测确认修复）

> 备注：`test_multi_panel_search_independence` 在紧跟 `test_split_preserve_scroll` 运行时偶发 `.log-row:visible` 超时，单独运行通过（2 passed），属 pre-existing 测试隔离问题（归档变更 tasks 4.3 已记录），与本变更无关。
