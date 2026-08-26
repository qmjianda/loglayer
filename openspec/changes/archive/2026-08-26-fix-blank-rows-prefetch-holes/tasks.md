# fix-blank-rows-prefetch-holes 任务

## 1. 复现与验收测试（先红后绿）

- [x] 1.1 repro 单测：模拟 readProcessedLines 首次返回空数组/抛错后恢复，断言窗口行最终被补齐（当前应红）
- [x] 1.2 repro 单测（后端）：请求区间含异常行时，返回数组定长且异常位置为 null 占位、后续行偏移正确（当前应红）
- [x] 1.3 单测：缺口对账工具函数——给定缓存命中集合与窗口区间，返回最小缺失子区间列表
- [x] 1.4 e2e：打开文件立即滚动到中部再快速回顶部，断言首屏无残留空白占位行

## 2. 前端实现

- [x] 2.1 lastFetchRef 标记时机后置：仅在结果覆盖请求区间时写入；失败/空响应不标记
- [x] 2.2 实现渲染窗口覆盖对账：bridgedLines 更新与 windowStart/End 变化时校验 [windowStart, windowEnd)，缺口子区间合并补拉
- [x] 2.3 回填循环适配 null 占位：null 不写入缓存并纳入缺口集合
- [x] 2.4 fetch 点位增加 LOGLAYER_DEBUG 门控日志（range/rows/ms），关闭零开销

## 3. 后端实现

- [x] 3.1 read_processed_lines 改为定长返回：异常/越界行以 null 占位，不再 continue 压缩数组
- [x] 3.2 更新受影响的集成测试（tests/integration/test_virtualization.py 等）适配新返回结构

## 4. 验证与收尾

- [x] 4.1 运行 1.1–1.4 全部转绿 + `python3 -m pytest tests/unit tests/integration` 无回归
- [x] 4.2 `ruff check backend tests` + `npx tsc --noEmit` + `npm run lint` 通过
- [x] 4.3 手动回归：大文件快速拖动进度条往返、筛选图层开关后首屏渲染、书签行定位正常
