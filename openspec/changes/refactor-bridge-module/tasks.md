# Tasks: refactor-bridge-module

## 1. 依赖分析与准备

- [ ] 1.1 绘制 `bridge.py` 内部依赖图（grep 所有 import 与跨符号引用，确认模块间依赖拓扑）
- [ ] 1.2 实测当前 `import bridge` 解析形态（文件模块 vs 包），决定 `__init__.py` 重导出 vs 门面文件方案
- [ ] 1.3 建立基线：跑 `pytest tests/unit` 确认当前全绿（65 passed）

## 2. 逐模块搬移（纯搬移，每步跑测试）

- [ ] 2.1 创建 `backend/bridge/` 包骨架与 `__init__.py` 占位
- [ ] 2.2 搬移 `LRUCache` → `cache.py`，跑 `pytest tests/unit` 保持绿灯
- [ ] 2.3 搬移 `Signal` → `signal.py`，跑测试
- [ ] 2.4 搬移路径/文件系统工具（convert/resolve/get_creationflags/get_log_files_recursive/get_directory_contents）→ `utils.py`，跑测试
- [ ] 2.5 搬移 `compute_search_matches` → `search_matching.py`，跑测试
- [ ] 2.6 搬移线程基类与 3 个 Worker（CustomThread/IndexingWorker/PipelineWorker/StatsWorker）→ `workers.py`，跑测试
- [ ] 2.7 搬移 `LogSession` → `session.py`，跑测试

## 3. 门面与导入兼容

- [ ] 3.1 `bridge/__init__.py` 配置重导出（FileBridge/Signal/LRUCache/各 Worker 符号）
- [ ] 3.2 `bridge.py` 瘦身为门面（保留 FileBridge 与模块级导出，兼容 `from bridge import X`）
- [ ] 3.3 验证 `backend/main.py`、`search_mixin.py` 既有导入零改动可用

## 4. 测试与文档

- [ ] 4.1 新增 `tests/unit/test_bridge_modules.py` 冒烟测试（子模块可导入 + 门面导出完整 + compute_search_matches 可直接调用）
- [ ] 4.2 跑完整后端套件：unit + integration 全绿（行为等价验证）
- [ ] 4.3 抽跑 1 个 e2e 冒烟（小样本，验证 FileBridge 启动路径）
- [ ] 4.4 更新 AGENTS.md 架构地图（backend 侧 bridge.py → backend/bridge/ 包）
- [ ] 4.5 可选：在 AGENTS.md 说明 `cache.py`（通用 LRU）与 `loglayer/cache_store.py`（业务缓存层）职责边界

## 5. 验证收尾

- [ ] 5.1 最终回归：完整 unit + integration + 冒烟 e2e 全绿
- [ ] 5.2 确认无遗留对 `bridge.py` 内部符号的引用（grep 校验）
- [ ] 5.3 按模块提交 git（每模块一提交，可独立 revert），准备归档
