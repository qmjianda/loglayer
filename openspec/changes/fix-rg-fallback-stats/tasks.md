# Tasks: fix-rg-fallback-stats

## 1. Backend

- [x] 1.1 `backend/bridge/utils.py`: 新增 `find_rg_binary()` 纯函数（候选路径 + PATH 回退，返回 Optional[str]）
- [x] 1.2 `backend/bridge/file_bridge.py`: `_get_rg_path()` 改用 `find_rg_binary()`，缺失时返回 None + 告警
- [x] 1.3 `backend/bridge/file_bridge.py`: `_calculate_log_level_stats()` 在 rg 不可用时降级 Python 统计
- [x] 1.4 `backend/bridge/workers.py`: `StatsWorker` 兼容 `rg_path=None`（空结果）
- [x] 1.5 `backend/bridge/search_matching.py`: `compute_search_matches` 兼容 `rg_path=None`（空数组）

## 2. Tests

- [x] 2.1 `tests/unit/test_rg_fallback.py`: rg 缺失时 `_calculate_log_level_stats` 返回全 0 不抛异常
- [x] 2.2 `tests/unit/test_rg_fallback.py`: `find_rg_binary()` 候选路径失效时回退 PATH / 返回 None
- [x] 2.3 `tests/unit/test_rg_fallback.py`: `StatsWorker(rg_path=None)` 正常 emit 空结果
