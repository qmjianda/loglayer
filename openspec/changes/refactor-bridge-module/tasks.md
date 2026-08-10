# Tasks: refactor-bridge-module

## 1. 依赖分析与准备

- [x] 1.1 绘制 `bridge.py` 内部依赖图（确认 8 个关注点：路径工具/LRUCache/文件遍历/Signal/线程+Worker/LogSession/FileBridge/搜索匹配；FileBridge 依赖 22 个模块级符号）
- [x] 1.2 实测导入解析形态：`from bridge import X`（backend/ 在 path）与 `from backend.bridge import X`（项目根在 path）是两种解析路径；统一用**包 + `__init__.py` 重导出**方案
- [x] 1.3 建立基线：跑 `pytest tests/unit` 确认当前全绿（基线为拆分前 65 passed，最终 120 passed 含新增）

## 2. 逐模块搬移（纯搬移，每步跑测试）

- [x] 2.1 创建 `backend/bridge/` 包骨架与 `__init__.py`
- [x] 2.2 搬移 `LRUCache` → `cache.py`
- [x] 2.3 搬移 `Signal` → `signal.py`
- [x] 2.4 搬移路径/文件系统工具（convert/resolve/get_creationflags/get_log_files_recursive/get_directory_contents + TIMING 打点）→ `utils.py`
- [x] 2.5 搬移 `compute_search_matches` → `search_matching.py`
- [x] 2.6 搬移线程基类与 3 个 Worker（CustomThread/IndexingWorker/PipelineWorker/StatsWorker + PROCESS_CLEANUP_TIMEOUT）→ `workers.py`
- [x] 2.7 搬移 `LogSession` → `session.py`；FileBridge 主体（1170 行）→ `file_bridge.py`

## 3. 门面与导入兼容

- [x] 3.1 `bridge/__init__.py` 配置重导出（18 个公共符号，含 FileBridge/Signal/LRUCache/各 Worker）
- [x] 3.2 **实现偏差**：`bridge.py` 被 `bridge/` 包完全替代（Python 中同名文件与包冲突、包优先，保留瘦身文件无意义）；删除原文件，由 `__init__.py` 重导出保证 `from bridge import X` 与 `from backend.bridge import X` 两种路径均可用
- [x] 3.3 验证 `backend/main.py`、`search_mixin.py` 既有导入零改动可用；手工启动后端验证 REST API 正常

## 4. 测试与文档

- [x] 4.1 新增 `tests/unit/test_bridge_modules.py` 冒烟测试（8 个：子模块可导入 + 门面导出完整 + 符号同一性 + 纯函数/构造/缓存/信号/工具函数）
- [x] 4.2 跑完整后端套件：unit + integration 共 120 passed（行为等价验证）；修复 `_get_rg_path` 因文件位置变化导致的 rg 路径偏差
- [x] 4.3 抽跑 e2e 冒烟（test_cache_reopen_ui + test_multi_panel_search，4 passed，小样本验证 FileBridge 启动路径）
- [x] 4.4 更新 AGENTS.md 架构地图（backend 侧 bridge.py → backend/bridge/ 包，含各子模块说明）
- [x] 4.5 AGENTS.md 已区分 `cache.py`（通用 LRU 结构）与 `loglayer/cache_store.py`（业务缓存层）职责

## 5. 验证收尾

- [x] 5.1 最终回归：unit + integration 120 passed + e2e 冒烟 4 passed + ruff 全过 + 手工后端启动验证
- [x] 5.2 grep 校验无遗留对 `bridge.py` 内部符号的引用；发现 `loglayer/export.py:225 from bridge import bridge` 为拆分前已存在的死代码（HEAD 版本同样缺失该变量），未在本次修复（超出纯搬移范围），已记录
- [ ] 5.3 按模块提交 git（每模块一提交，可独立 revert），准备归档（需用户提交，见会话收尾说明）
