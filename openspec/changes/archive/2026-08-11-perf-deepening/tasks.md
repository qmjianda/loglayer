# Tasks: perf-deepening

## 1. 验收测试（先红后绿）

- [x] 1.1 渲染器 LRU 缓存单测（vitest）：重复内容行命中缓存不重算、有界淘汰、配置签名区分新旧配置
- [x] 1.2 有界看门狗单测（vitest，mock rAF）：空闲稳定后停止检测、面板激活事件重新武装、用户滚到顶/程序化跳顶不被误干预
- [x] 1.3 统一防抖单测（vitest，fake timers）：250ms 内连续输入仅触发一次、间隔拉长逐次触发
- [x] 1.4 请求序号单测（vitest）：requestSeq/consumedSeq 状态机 + isStalePipelineResult 过期判定（App 端应用语义见 3.5 边界说明）
- [x] 1.5 组件渲染测试（vitest）：SkeletonRows 骨架占位 + InspectorSummary 统计骨架；IndexingOverlay 挂载经 e2e 验证
- [x] 1.6 FPS 采集纯函数单测（vitest）：computeAverageFps 计算正确、低帧率标记阈值生效

## 2. 渲染节流实现

- [x] 2.1 LogViewer.tsx 有界看门狗：稳定帧计数空闲睡眠 + scroll/resize/fileId/isActive 重新武装，保留 80ms 用户滚动保护与 scrollToIndex 同步 ref
- [x] 2.2 EditorArea.tsx 传递 isActive（基于 onDidActivePanelChange）给 LogViewer
- [x] 2.3 LogViewer.tsx 渲染依赖引用稳定：EMPTY_LAYERS/EMPTY_BOOKMARKS module 常量 + colors useMemo(theme)
- [x] 2.4 registry.ts 渲染结果 LRU：createRenderCache(500) + renderLayers 接入，配置签名入 key
- [x] 2.5 useVirtualScroll 精简：删除空壳（handleActivity/空 idle 检测），FPS 计算抽纯函数导出，预测/降质函数标注二期
- [x] 2.6 FPS 接线：debugMode 下 LogViewer 调用 useVirtualScroll，metrics 传入 PerformanceIndicator（StatusBar 条件已存在）

## 3. 搜索去抖实现

- [x] 3.1 hooks 新增 useDebouncedValue(250ms) + SEARCH_DEBOUNCE_MS
- [x] 3.2 useSearch.ts 收敛统一防抖：移除 300ms 手写 setTimeout，改监听去抖值触发 syncAll
- [x] 3.3 SearchPanel.tsx 移除 200ms 防抖，onSearch 直接 setQuery
- [x] 3.4 searchStore.ts 增加 requestSeq/consumedSeq 字段 + bumpSearchSeq/markSearchConsumed/isStalePipelineResult
- [x] 3.5 App.tsx onPipelineFinished 在途搜索序号校验（markSearchConsumed 推进）；触发点在 useSearch bumpSearchSeq
      （边界：信号不带请求序号，字面"残留即丢弃"会误杀图层结果——过期防护以既有后端 worker 取消 + AbortSignal 为主）
- [x] 3.6 bridge_client.ts post() 支持 AbortSignal；syncAll 返回 AbortController；useSearch 防抖清理/新触发时 abort，AbortError 静默

## 4. 骨架屏实现

- [x] 4.1 EditorArea.tsx 挂载 IndexingOverlay：indexingFileIds 含 fileId 时叠加渲染，进度经 indexingProgress 传入
- [x] 4.2 抽 SkeletonRows 组件（animate-pulse，复用 FileLoadingSkeleton 设计语言）
- [x] 4.3 SearchResultsPanel.tsx 加载中渲染 SkeletonRows 替代纯文字
- [x] 4.4 App.tsx 增加 statsLoading 状态（请求发起到数据到达）+ InspectorDock/InspectorPanel 透传
- [x] 4.5 InspectorSummary.tsx 接收 loading prop，为真时渲染统计骨架条

## 5. 回归与收尾

- [x] 5.1 vitest 全量通过（12 文件 85 用例，含既有测试 + 验收测试全绿）
- [x] 5.2 npx tsc --noEmit 0 错误 + npm run lint 0 error + prettier 通过
- [x] 5.3 e2e light 回归核心交互（打开文件/滚动/搜索/索引进度）→ 22/22 通过（含 scroll 保持与多面板搜索）
- [x] 5.4 openspec-cn validate 通过
