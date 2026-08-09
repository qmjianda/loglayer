## Why

`backend/bridge.py` 已达 1,916 行，内部实际混杂了 8 个关注点（路径工具、LRUCache、文件系统遍历、Signal 事件、CustomThread 与 3 个 Worker、LogSession、FileBridge 主类、搜索匹配纯函数）。FileBridge 已用 `SearchPipeline, BookmarkPipeline` Mixin 组合，说明模块化意图存在但缺少物理边界。文件越长，修改回归风险越高、测试越难写、新成员理解成本越大。

## What Changes

- **拆分 `bridge.py` 为 `backend/bridge/` 包**：按关注点拆分为 `utils.py`、`cache.py`、`signal.py`、`workers.py`、`session.py`、`search_matching.py`（纯函数），`bridge.py` 保留 `FileBridge` 门面与模块级导出兼容。
- **纯搬移，不改行为**：本次变更只做物理拆分与导入调整，不修改任何业务逻辑、线程模型或缓存策略；行为变更留待后续独立变更。
- **保持外部导入兼容**：`backend/main.py`、`search_mixin.py`、测试与 e2e 对 `bridge` 的既有导入方式不破坏。
- **补结构级测试**：为拆分后的模块边界补冒烟测试（如各子模块可独立导入、FileBridge 行为与拆分前一致——复用现有 65 个单测作为回归基线）。

## Capabilities

### New Capabilities
- `backend-module-structure`: 定义后端核心模块的物理组织规则（单一关注点一文件、文件行数警戒线、门面模式保持导入兼容）。

### Modified Capabilities

（无既有能力的行为需求发生变化——纯结构重构，spec 层面行为不变。）

## Impact

- **修改**：`backend/bridge.py`（瘦身为门面）、新增 `backend/bridge/` 子模块、`backend/main.py` 与 `search_mixin.py` 的导入路径（如需调整）、`AGENTS.md` 架构地图更新。
- **测试**：现有 65 个单测 + 12 integration 作为回归基线；新增模块边界冒烟测试。
- **不改动**：任何业务行为、线程模型、缓存/LRU 逻辑、REST/WS 接口契约。
- **风险**：导入循环（子模块间相互依赖）需在拆分时理顺；`__init__.py` 的导出设计需保证 `from bridge import X` 风格调用不失效。
