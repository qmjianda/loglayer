## ADDED Requirements

### Requirement: 公开文档描述与实现一致

系统 SHALL 确保 README 等面向用户的公开文档中的能力描述与实际实现一致，禁止保留名实不符的表述（如声称 Canvas 渲染而实际为 DOM 虚拟滚动）。

#### Scenario: 虚拟化渲染描述准确

- **WHEN** README 描述日志渲染能力
- **THEN** 表述为 DOM 虚拟滚动（react-virtuoso）+ 预加载 + memo 优化
- **AND** 不出现 "O(1) Virtual Scrolling" 或 Canvas 渲染等误导性表述

#### Scenario: 文档导航覆盖工程化信息

- **WHEN** AI 或开发者需要了解版本号、CHANGELOG 或 lint/CI 命令
- **THEN** 系统经 AGENTS.md 或 README 即可定位
- **AND** 无需猜测命令入口

## MODIFIED Requirements

### Requirement: 决策记录分层管理

系统 SHALL 将已定案的技术决策（ADR）作为冻结历史保留，不再随代码演进改写；新决策一律通过 openspec 变更流程记录在 `design.md` 或能力 spec 中。**名实不符的历史表述（如 README 中的 Canvas 虚拟滚动声称）在修正时同步在冻结文档中标注更正，但不再改写 ADR 正文。**

#### Scenario: 查询历史决策

- **WHEN** AI 需要了解某项早期技术决策（如 Canvas 虚拟滚动）的背景与理由
- **THEN** 系统从冻结的 ADR 文档读取完整决策链（背景/方案/决策/后果）
- **AND** 可看到文档体系中记录的名实修正声明

#### Scenario: 记录新决策

- **WHEN** 一个功能变更涉及新的技术决策
- **THEN** 该决策记录在对应 openspec 变更的 `design.md`
- **AND** 不追加进冻结的 ADR 文档
