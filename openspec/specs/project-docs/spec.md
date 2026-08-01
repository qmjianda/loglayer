# project-docs Specification

## Purpose

定义 LogLayer 项目文档体系的组织规则：AGENTS.md 作为 AI 会话唯一入口，状态类信息由 openspec 实时查询承载，深潜文档按需留存，决策记录分层管理，所有变更统一走 openspec 流程。

## Requirements

### Requirement: AGENTS.md 作为唯一会话入口

系统 SHALL 将 `AGENTS.md` 作为 AI 新会话的唯一启动入口，内容涵盖：项目概况与技术栈、开发/测试/构建命令、粗略架构地图（模块 + 数据流）、代码规范、Git 约定、以及指向 openspec 与深潜文档的导航指针。

#### Scenario: 新会话启动读取单一入口

- **WHEN** 一个新 AI 会话开始
- **THEN** 系统经 AGENTS.md 即可建立项目心智模型（概况、规则、架构）
- **AND** 无需再逐一阅读 `docs/` 下的多个文档

#### Scenario: 架构地图为粗略快照

- **WHEN** AGENTS.md 中的架构地图与当前代码存在细节出入
- **THEN** AI 以代码为准核实细节
- **AND** 地图仅作为出发坐标，不承诺与实现逐行一致

### Requirement: 开发状态由 openspec 实时查询承载

系统 SHALL 停止以手写文档（如 `docs/PROGRESS.md`）记录开发进度与任务状态，改由 `openspec-cn list/status --json` 从变更文件实时查询。

#### Scenario: 获取当前进度

- **WHEN** AI 或开发者需要了解当前开发状态
- **THEN** 系统经 `openspec-cn list --json` 输出活跃变更、任务完成数与最近修改时间
- **AND** 无需维护独立的进度文档

#### Scenario: 删除遗留进度文档

- **WHEN** 旧 `docs/PROGRESS.md` 仍存在
- **THEN** 系统将其从知识体系中移除
- **AND** 不保留任何手写的进度快照

### Requirement: 深潜文档按需留存并提供指针

系统 SHALL 将操作型深度文档（图层开发指南、索引优化说明等）保留在 `docs/`，并在 AGENTS.md 中提供指针，供 AI 按任务类型按需深潜阅读。

#### Scenario: 图层开发需要深度指南

- **WHEN** AI 需要开发或修改一个图层
- **THEN** 系统经 AGENTS.md 中的指针找到 `docs/LAYER_DEV_GUIDE.md`
- **AND** 按其中步骤实现

#### Scenario: 非相关文档不进入会话心智

- **WHEN** 当前任务与某个深潜文档无关
- **THEN** AI 无需预读该文档
- **AND** 仅按需加载

### Requirement: 决策记录分层管理

系统 SHALL 将已定案的技术决策（ADR）作为冻结历史保留，不再随代码演进改写；新决策一律通过 openspec 变更流程记录在 `design.md` 或能力 spec 中。

#### Scenario: 查询历史决策

- **WHEN** AI 需要了解某项早期技术决策（如 Canvas 虚拟滚动）的背景与理由
- **THEN** 系统从冻结的 ADR 文档读取完整决策链（背景/方案/决策/后果）

#### Scenario: 记录新决策

- **WHEN** 一个功能变更涉及新的技术决策
- **THEN** 该决策记录在对应 openspec 变更的 `design.md`
- **AND** 不追加进冻结的 ADR 文档

### Requirement: 变更统一走 openspec 流程

系统 SHALL 将所有后续功能开发、架构调整与重构通过 OpenSpec 变更流程推进，产出 proposal/design/specs/tasks，不在独立文档中记录一次性变更内容。

#### Scenario: 新功能开发启动

- **WHEN** 需求产生需要开发新功能
- **THEN** 系统经 `openspec-cn new change` 创建变更
- **AND** 依次完成 proposal、specs、design、tasks 产出物后再实现

#### Scenario: 变更状态可追踪

- **WHEN** 需要了解某变更的进度
- **THEN** 系统经 `openspec-cn status --change <name> --json` 查询
- **AND** 完成后经 `openspec-cn archive` 归档到主 specs
