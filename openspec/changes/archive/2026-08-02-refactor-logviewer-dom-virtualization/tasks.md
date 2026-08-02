# Tasks: LogViewer DOM 虚拟化重构

## 1. 依赖与基线

- [x] 1.1 在 `frontend/package.json` 添加 `react-virtuoso`（^4.x，MIT）依赖并安装
- [x] 1.2 运行 `npx tsc --noEmit` 确认现有代码基线类型检查通过

## 2. 行渲染组件 LogRow

- [x] 2.1 新建 `frontend/src/components/logViewer/LogRow.tsx`：接收 `LogLine`，渲染内容文本 + `highlights` 分段着色（搜索/图层高亮） + `rowStyle` 背景/文字颜色
- [x] 2.2 LogRow 渲染书签指示（`isMarked`/`bookmarkComment`）与当前行高亮
- [x] 2.3 从 `frontend/src/theme.ts` `getLogViewerColors` 读取配色，支持 dark/light 主题

## 3. 虚拟化外壳集成

- [x] 3.1 重构 `frontend/src/components/LogViewer.tsx`：用 `<Virtuoso totalCount={totalLines}>` 替代 canvas 渲染路径，`itemContent` 渲染 `LogRow`
- [x] 3.2 接入 `customScrollParent`（dockview 面板容器），支持分屏多面板独立滚动
- [x] 3.3 将现有 `bridgedLines` 按需拉取逻辑挂到 virtuoso `rangeChanged` 回调，保留 fetch 去重与缓存窗口
- [x] 3.4 亿行滚动定位：固定行高下用 `scrollToIndex` 二分定位替代线性压缩换算，验证 GB 级文件滚动精度
- [x] 3.5 若 3.4 精度不足，引入分段滚动（`scrollMargin`，每段固定行数）作为兜底方案

## 3A. 拖动白屏优化（scrollSeek 占位 + 后端缓存）

- [x] 3A.1 配置 virtuoso `scrollSeekConfiguration`（速度阈值 enter/exit）与 `ScrollSeekPlaceholder` 占位行（行号 + 骨架条）
- [x] 3A.2 验证拖动滚动条时占位行即时显示、停止后真实行替换
- [x] 3A.3 评估并实施后端 `read_processed_lines` 行缓存增强（扩大 `rendering_cache` 或分层响应：先纯文本后补高亮）

## 4. 行号 gutter

- [x] 4.1 在虚拟化容器左侧实现独立 sticky 行号列，水平滚动时保持固定
- [x] 4.2 行号与行内容垂直对齐，跟随 `settings.showLineNumbers` 开关

## 5. 原生文本交互与键盘导航

- [x] 5.1 移除手写 canvas 选区逻辑，改用浏览器原生选择；确认拖拽选择、复制、双击选词、中文字符选择正常
- [x] 5.2 将现有键盘导航（Ctrl+G 跳行、Ctrl+A 全选、选区上下移动、Ctrl+Shift+L 选整行）映射到 Virtuoso `scrollToIndex` 与原生 Selection API
- [x] 5.3 保留 context menu（复制/发送 AI/高亮/过滤/JSON 展开/书签）与 `onSelectedTextChange` 回调

## 6. 字体缩放与双模式行高

- [x] 6.1 打通 `settings.fontSize`/`settings.lineHeight` 修改：改后强制重新测量/重建行高缓存，确认行显示正常
- [x] 6.2 实现水平滚动模式（固定行高，`white-space: nowrap`）
- [x] 6.3 实现自动换行模式（wordWrap，动态行高），切换时清空行高缓存

## 7. 装饰保留

- [x] 7.1 保留并移植 Overview Ruler（右侧分布标尺，`layerStats`/bookmarks 指示）为 DOM/CSS 实现
- [x] 7.2 保留 JSON 展开、书签 popover、新内容提示等悬浮 UI 组件

## 8. 清理与验证

- [x] 8.1 清理未使用的 canvas 渲染路径；决定 `hooks/useVirtualScroll.ts`/`useCanvasRender.ts`/`useSelection.ts` 废案去留（复用或删除）
- [x] 8.2 重写 `tests/e2e/test_large_file_rendering.py` 与 `tests/e2e/helpers.py` 的 `collect_canvas_state`：断言改为 DOM 结构（可见行数、aria-label、gutter 固定、无前端错误）
- [x] 8.3 新增/更新 e2e：拖动滚动条时占位行可见（scrollSeek）；滚动停止后真实行替换
- [x] 8.4 更新 `frontend/src/constants.ts` `LOG_VIEWER` 中不再适用的常量（如 canvas 相关）
- [x] 8.5 手动回归：GB 级文件滚动定位、中文选择/复制、字体缩放、gutter 固定、wordWrap 双模式、分屏多面板、拖动白屏修复
- [x] 8.6 运行 `npx tsc --noEmit` 与 `npm run build` 确认构建通过
- [x] 8.7 运行 e2e（`python3 -m pytest tests/e2e -v`，需 12345 后端 + vite 3000 + chromium）确认通过
