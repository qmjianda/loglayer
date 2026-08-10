## Context

`backend/bridge.py`（1,916 行）实际混杂 8 个关注点：路径工具、LRUCache、文件系统遍历、Signal 事件、CustomThread 与 3 个 Worker、LogSession、FileBridge 主类、搜索匹配纯函数。`FileBridge(SearchPipeline, BookmarkPipeline)` 已用 Mixin 组合，说明模块化意图存在，但缺少物理边界——单文件越长，回归风险与理解成本越高。

现有资产可复用：
- 65 个后端单测 + 12 个 integration 作为行为回归基线。
- `backend/loglayer/` 已是包化组织（core/registry/builtin/cache_store），`bridge/` 拆分可对齐其风格。
- `search_mixin.py`（270 行）已独立，本次不改动其内容，仅理顺 import。

约束：
- 纯搬移，不改行为：线程模型（CustomThread + 3 Worker）、缓存策略（LRU/缓存层）、接口契约（REST/WS）全部保持不变。
- 保持导入兼容：`backend/main.py`、`search_mixin.py`、tests、e2e 对 `bridge` 的既有导入方式不破坏。
- 文件命名与 `backend/loglayer/` 现有风格一致（snake_case 模块）。

## Goals / Non-Goals

**Goals:**
- `bridge.py` 瘦身为门面（FileBridge + 导出），拆分出单一关注点子模块。
- 拆分后现有测试套件全绿（行为等价）。
- 为模块边界补冒烟测试。
- 更新 AGENTS.md 架构地图中 backend 侧描述。

**Non-Goals:**
- 不改业务逻辑、线程模型、缓存策略、接口契约（spec 已锁定行为等价）。
- 不顺手重构 Worker 实现（如并发模型调整）——那属于后续独立变更。
- 不拆分 `backend/main.py`（621 行，路由层另议）。
- 不做 App.tsx 前端拆分（那是独立的 `refactor-app-orchestration` 变更）。

## Decisions

### D1: 按关注点拆为 6 个模块 + 门面

**决策**：

```
backend/bridge.py        → 门面（FileBridge + 模块级导出，兼容旧导入）
backend/bridge/
├── __init__.py          → from .utils import * 等重导出（兼容 from bridge import X）
├── utils.py             → convert/resolve 路径工具、get_log_files_recursive、get_directory_contents、get_creationflags
├── cache.py             → LRUCache
├── signal.py            → Signal
├── workers.py           → CustomThread、IndexingWorker、PipelineWorker、StatsWorker
├── session.py           → LogSession
└── search_matching.py   → compute_search_matches（纯函数）
```

**备选考虑**：
- *保持单文件、仅内部加注释分区*：缓解不了"越长越难测/越难并行开发"的根本问题，排除。
- *按 Worker 粒度拆成更多文件*：IndexingWorker/PipelineWorker/StatsWorker 共享 CustomThread 基类与线程取消协议，同置 `workers.py` 内聚更强，排除过度拆分。

**理由**：6 模块是"关注点单一 + 内聚不碎"的平衡点；`__init__.py` 重导出保证外部 `from bridge import X` 零改动。

### D2: 用 `__init__.py` 重导出保持向后兼容

**决策**：`bridge/__init__.py` 显式 `from .workers import ...`、`from .session import ...` 等，使 `from bridge import FileBridge, Signal, LRUCache` 等旧导入继续有效；同时保留 `backend/bridge.py` 作为薄门面（若现有代码 `from bridge import` 命中包而非模块，则改为包 + `__init__` 重导出，二者择一以实际导入解析为准）。

**备选考虑**：
- *全量改写导入点*（main.py/search_mixin/tests 全部 `from bridge.workers import ...`）：改动面大、违背"纯搬移"目标，排除。

**理由**：重导出是"零外部改动"的桥接方案；内部新代码可逐步改用精确导入。

### D3: 拆分顺序按依赖拓扑，每步跑测试

**决策**：按"叶子模块 → 根模块"顺序搬移：`cache.py`（无依赖）→ `signal.py` → `utils.py` → `search_matching.py`（依赖 utils）→ `workers.py`（依赖 signal/cache/utils）→ `session.py` → `bridge.py` 瘦身。每完成一个模块搬移即跑一次 `pytest tests/unit`（约 6 秒），保持绿灯。

**备选考虑**：
- *一次性大搬移*：中间态不可验证，出错难定位，排除。

**理由**：每步可验证的搬移将"重构风险"摊薄为"可回退的小步"；配合 git 分阶段提交，任一模块出错可独立 revert。

### D4: 模块边界冒烟测试放 `tests/unit/test_bridge_modules.py`

**决策**：新增冒烟测试：断言各子模块可导入、门面导出完整（FileBridge/Signal/LRUCache/各 Worker 符号存在）、`compute_search_matches` 纯函数可直接调用。

**备选考虑**：
- *为每个模块写完整单测*：现有 65 个测试已覆盖行为，冒烟测试只验证"结构正确"，避免重复覆盖，排除。

**理由**：结构重构的验证重点是"拆分没拆坏"，行为已由既有测试兜底。

## Risks / Trade-offs

- **[导入循环依赖] → Mitigation**：按 D3 的拓扑顺序搬移，天然避免；搬移前先列出模块间依赖图（grep import）。
- **[`from bridge import X` 在包/模块切换时解析异常] → Mitigation**：拆分前先验证当前导入解析方式（`python -c "import bridge"` 看解析到文件还是包）；用 `__init__.py` 重导出覆盖两种形态。
- **[纯搬移仍引入行为差异（如全局变量/可变默认参数顺序）] → Mitigation**：搬移时保持行级语义不变（不做顺手格式化）；每步跑测试 + 最后跑完整套件（65 单测 + 12 integration + 抽跑 1 个 e2e 冒烟）。
- **[e2e 依赖大文件不可在本机完整回归] → Mitigation**：拆分是结构变更，e2e 冒烟用 `tests/logs/` 中小样本即可覆盖 FileBridge 启动路径；1.3GB 全量 e2e 留给发布阶段验证。
- **[`backend/main.py` import 路径调整] → Mitigation**：若 `main.py` 使用 `from bridge import ...`，门面重导出保证零改动；仅当存在 `from backend.bridge` 前缀差异时才调整，且调整后立即跑 integration 测试。

## Migration Plan

1. 依赖分析：grep 当前 `bridge.py` 内部所有 import 与跨模块引用，绘制依赖图。
2. 按 D3 顺序逐模块搬移（cache → signal → utils → search_matching → workers → session），每步跑 `pytest tests/unit`。
3. 建 `bridge/__init__.py` 重导出，验证 `from bridge import X` 全部有效。
4. `bridge.py` 瘦身为门面（保留 FileBridge 与模块级导出）。
5. 跑完整后端套件（unit + integration），再抽跑 1 个 e2e 冒烟（小样本）。
6. 更新 AGENTS.md 架构地图（backend 侧"bridge.py"描述改为"backend/bridge/ 包"）。
7. 回滚策略：拆分按模块分阶段 git 提交；任一阶段失败，`git revert` 对应提交即可回到可运行状态。

## Open Questions

- 现有代码对 `bridge` 的导入是"文件模块"还是"包"形态？实现前需实测确认，决定 `__init__.py` 重导出 vs 纯门面文件二选一。
- `backend/loglayer/` 已有 `cache_store.py`（缓存层），拆分出的 `cache.py`（LRUCache 通用结构）与其职责边界是否需要在 AGENTS.md 说明？倾向加一行注释区分"通用 LRU 结构" vs "业务缓存层"。
