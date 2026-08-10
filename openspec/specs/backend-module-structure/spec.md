## Purpose

将 `backend/bridge.py` 按关注点物理拆分为 `backend/bridge/` 包（单一关注点对应单一文件），`bridge.py` 保留 `FileBridge` 门面并维持模块级导出兼容；纯结构重构，不改变行为；为拆分后的模块边界提供冒烟测试。

## Requirements

### Requirement: bridge 模块物理拆分

系统 SHALL 将 `backend/bridge.py` 按关注点拆分为 `backend/bridge/` 包，单一关注点对应单一文件，`bridge.py` 保留 `FileBridge` 门面并维持模块级导出兼容。

#### Scenario: 子模块可独立导入

- **WHEN** 导入 `backend.bridge.utils`、`backend.bridge.cache`、`backend.bridge.workers` 等子模块
- **THEN** 各子模块可独立导入且无循环依赖
- **AND** 每个子模块仅承载一个明确关注点（路径工具 / 缓存 / 线程 / 会话等）

#### Scenario: 门面保持外部兼容

- **WHEN** 现有代码 `from bridge import FileBridge` 或类似导入
- **THEN** 导入路径与使用方式与拆分前一致
- **AND** `backend/main.py`、`search_mixin.py`、测试与 e2e 无需改动调用方式

### Requirement: 拆分不改变行为

系统 SHALL 保证纯结构重构：拆分过程中不修改任何业务逻辑、线程模型、缓存策略或接口契约，拆分前后行为等价。

#### Scenario: 回归基线通过

- **WHEN** 拆分完成后运行现有测试套件
- **THEN** 后端 65 个单测与 12 个 integration 测试全部通过
- **AND** 无测试因行为差异而需要修改断言

#### Scenario: 接口契约不变

- **WHEN** 对比拆分前后 REST/WS 接口行为
- **THEN** 所有既有端点请求/响应结构一致
- **AND** 无新增或移除端点

### Requirement: 模块边界有冒烟测试

系统 SHALL 为拆分后的模块边界提供冒烟测试，验证子模块可导入、FileBridge 门面可用、模块间协作正常。

#### Scenario: 冒烟测试通过

- **WHEN** 运行新增的模块边界冒烟测试
- **THEN** 各子模块可导入、门面导出完整
- **AND** 测试覆盖新文件结构的核心入口
