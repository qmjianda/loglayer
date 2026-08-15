# Tasks: fix-scroll-empty-screen

## 1. 验收测试（ATDD 红）

- [x] 1.1 预取范围单测（vitest）：抽纯函数 `computePrefetchRange(topVisibleLine, visibleRows, M, totalLines)` 返回「可视区 ± M」且 clamp 到 `[0, totalLines)`，覆盖顶部/底部越界。
- [x] 1.2 运行 `npx vitest run` 确认新测试失败（红）。

## 2. 静态对称预取 + 在途不取消（preload-optimization）

- [x] 2.1 `constants.ts` 新增 `PREFETCH_BUFFER` 配置常量（默认 100，成熟参照 AG Grid `cacheBlockSize`，后续调参）。
- [x] 2.2 `LogViewer.tsx` fetch effect 重写：按渲染窗口 ± `PREFETCH_BUFFER` 拉取（clamp 到 `[0, totalLines)`）；渲染窗口不动。
- [x] 2.3 移除时间防抖（窗口 re-anchor 时立即拉取，靠 re-anchor 滞后限流）；在途请求不取消（移除 `ignore=true` 丢弃），返回按行号幂等合并。
- [x] 2.4 确认无 `useVirtualScroll` 预测函数依赖（仅用 `metrics`，预测函数本未接线）。

## 3. 数据变化清空缓存（log-viewer-lazy-loading）

- [x] 3.1 `updateTrigger` 变化时清空 `bridgedLines`（`setBridgedLines(new Map())`），再走 2.2 重拉。

## 4. 验证与回归

- [x] 4.1 `npx tsc --noEmit`（EXIT 0）+ `npm run lint`（error=0）+ `npx vitest run`（全绿，12 文件 85 测试）。
- [x] 4.2 e2e 回归：`npm run e2e` 23/24 通过；1 个失败为 pre-existing 的 `test_multi_panel_search_independence`（dockview always-render 致两个搜索框 selector strict-mode 冲突），与本变更无关。
- [x] 4.3 回归验证：heavy e2e 4/4 通过（含 `test_fast_scroll_shows_placeholder_then_content`：拖条到 80% → 占位行先显示行号 → 内容填充，不空白）；滚轮手感与 `PREFETCH_BUFFER` 调参留给用户实测。
