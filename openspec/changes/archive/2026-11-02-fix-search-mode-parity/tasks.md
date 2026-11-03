# Tasks: fix-search-mode-parity

## 1. 验收测试（ATDD，先写先红）

- [x] 1.1 新增 `tests/unit/test_search_mode_parity.py`：用临时日志文件调用 `compute_search_matches`，断言整词模式下 `ERROR` 不命中 `ERROR_CODE`，非整词模式命中
- [x] 1.2 同文件覆盖 `intersect_sorted_indices`：全等、子集、空集、无交集、大数组双指针结果正确且保持升序
- [x] 1.3 同文件增加管线级用例：过滤模式下 `visible_indices` 等于匹配集；切回高亮后等于图层基础集；清空搜索后恢复基础集（用临时文件 + `FileBridge` 公开 API）
- [x] 1.4 扩展 `frontend/src/hooks/useSearch.test.ts`：断言 `syncAll` 收到的搜索载荷包含 `wholeWord` 与 `mode`
- [x] 1.5 新增 `tests/e2e/test_search_filter_mode.py`：搜索后切过滤模式，断言可见行数等于匹配数；清空搜索恢复原行数
- [x] 1.6 运行 1.1–1.5，确认全部失败（红），记录失败输出作为实现前基线

## 2. 后端实现

- [x] 2.1 在 `backend/bridge/search_matching.py` 新增纯函数 `intersect_sorted_indices(base, matches)`（O(n+m) 双指针，输出 `array('I')`）
- [x] 2.2 `LogSession` 增加 `base_visible_indices` 字段并在打开/关闭时正确初始化与释放
- [x] 2.3 `FileBridge` 新增 `_apply_search_filter(session)`：按 `search_config.mode == "filter"` 与查询词计算最终 `visible_indices`，非过滤模式回落 base
- [x] 2.4 在 `_on_pipeline_finished` 与 `_start_pipeline` 的三条 `pipelineFinished` 路径统一调用 `_apply_search_filter`，保证真实计算与缓存命中结果一致
- [x] 2.5 图层过滤缓存读写改用 `base_visible_indices`，确保过滤结果不污染缓存；搜索缓存键保持 `compute_query_hash`（含 `wholeWord`、不含 `mode`）
- [x] 2.6 `search_ripgrep` 桥接方法与 `/api/search_ripgrep` 增加可选 `whole_word`、`mode` 参数并透传，保持与主路径语义一致

## 3. 前端实现

- [x] 3.1 `frontend/src/hooks/useSearch.ts` 的 `searchConf` 补齐 `wholeWord` 与 `mode`
- [x] 3.2 `frontend/src/bridge_client.ts` 与 `frontend/src/types.ts` 为 `search_ripgrep` 增加可选 `wholeWord`/`mode` 参数
- [x] 3.3 核对过滤模式下的匹配计数、无结果提示、清空搜索恢复与面板独立行为，缺失处补齐

## 4. 验证与收尾

- [x] 4.1 `python3 -m pytest tests/unit tests/integration -q` 全绿
- [x] 4.2 `npx tsc --noEmit`、`npm run lint`、`npm run format:check`、`npm test` 全绿
- [x] 4.3 `npm run e2e -- --reuse`（或按环境启动）通过新增过滤模式用例与既有搜索用例
- [x] 4.4 `openspec validate fix-search-mode-parity --strict` 通过
- [x] 4.5 运行 `python tests/benchmarks/benchmark_guard.py`，确认索引/搜索阈值无回退
