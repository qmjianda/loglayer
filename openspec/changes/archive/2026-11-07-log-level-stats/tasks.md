## 1. 验收测试（先红）

- [x] 1.1 新增 `tests/unit/test_log_level_stats.py`：覆盖按行计口径（重复 token 只计一次、多级别行归最高优先级、大小写不敏感、各级别之和等于有级别行数）
- [x] 1.2 在同一测试文件补充缓存场景：命中不启动 rg、size/mtime 变化后失效、超过上限按 LRU 淘汰
- [x] 1.3 补充并发场景：同一文件并发请求只启动一次 rg、不同文件并发互不阻塞
- [x] 1.4 回归 `log-level-stats-resilience`：rg 缺失时仍返回全 0 并打印 `[LogLevelStats]` 告警
- [x] 1.5 新增 `frontend/src/hooks/useLogLevelStats.test.ts`：A→B 快速切换时 A 的迟到响应被丢弃、加载态只由当前请求结束
- [x] 1.6 运行新增测试确认失败（红）：`python3 -m pytest tests/unit/test_log_level_stats.py`、`npx vitest run src/hooks/useLogLevelStats.test.ts`

## 2. 后端实现

- [x] 2.1 将 `_calculate_log_level_stats` 改为单次 `rg -o -n` 流式扫描，按行号归并并取最高优先级（`FATAL > ERROR > WARN > INFO > DEBUG > TRACE`）
- [x] 2.2 显式以 UTF-8 解码子进程输出并清理 `\r`，保持 30s 超时与 returncode 0/1 语义
- [x] 2.3 在 `FileBridge` 增加有界统计缓存：键 `(realpath, size, mtime_ns)`，上限 64 个文件，按最近使用淘汰
- [x] 2.4 实现 `invalidate_stats(path)` 与统计缓存清空入口，供 live-tail 与 `/api/cache/clear` 调用
- [x] 2.5 实现同一缓存键的 in-flight 去重：执行者扫描，等待者复用结果；不同文件并行；失败结果不缓存
- [x] 2.6 `get_log_level_stats` 接入缓存与去重，并记录 hit/miss 计数
- [x] 2.7 `/api/diagnostics` 返回 stats 缓存 hit/miss；`/api/cache/clear` 同时清理统计缓存与 in-flight 记录

## 3. 前端实现

- [x] 3.1 新增 `frontend/src/hooks/useLogLevelStats.ts`：请求序号、激活文件校验、切换时清空旧值并进入 loading
- [x] 3.2 `App.tsx` 改用 `useLogLevelStats`，删除内联的 `fetchLogLevelStats` 与相关状态
- [x] 3.3 删除未被引用的 `frontend/src/hooks/useLogStats.ts` 及其导出
- [x] 3.4 `InspectorSummary` 级别分布提示文案补充“按行统计”（不改布局与字段）

## 4. 验证与收尾

- [x] 4.1 运行 `python3 -m pytest tests/unit/test_log_level_stats.py -q` 确认转绿
- [x] 4.2 运行 `python3 -m pytest -q` 与 `ruff check backend tests` 全绿
- [x] 4.3 运行 `npx vitest run --maxWorkers=2`、`npx tsc --noEmit`、`npm run lint`、`npm run format:check` 全绿
- [x] 4.4 运行 e2e 冒烟（切换 tab 后级别分布可见且非全 0），确认无前端错误
- [x] 4.5 更新 `proposal.md`/设计文档中与实际实现不一致的细节（如有），并执行 `openspec validate log-level-stats --strict`
