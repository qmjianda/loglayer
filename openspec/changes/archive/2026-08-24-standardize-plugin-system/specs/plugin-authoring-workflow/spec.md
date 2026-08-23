## Purpose

为人工和 AI 创建插件提供可复制的文档、模板和验收验证流程。

## ADDED Requirements

### Requirement: 文档与模板
项目 SHALL 提供插件开发文档和模板，覆盖 manifest、能力声明、安装发现、外部目录、固定 UI 槽位、旧兼容边界和受信任 Python MVP 限制。

#### Scenario: 按模板创建插件
- **WHEN** 开发者使用模板填写插件 ID、版本、能力和入口
- **THEN** 可生成符合协议的最小插件包或外部目录插件

#### Scenario: 文档说明安全边界
- **WHEN** 开发者阅读插件开发指南
- **THEN** 能明确知道插件是进程内受信任 Python 代码，MVP 不提供沙箱

### Requirement: AI authoring skill
项目 SHALL 提供 `plugin-authoring` AI 技能，引导 AI 先确认能力和槽位，再生成 manifest、插件代码、示例和验收测试。

#### Scenario: AI 生成新插件
- **WHEN** 用户请求 AI 创建一个插件
- **THEN** AI 生成 manifest、最小实现和与每个行为对应的验收测试，并说明安装或外部加载方式

#### Scenario: AI 请求任意 React 代码
- **WHEN** 用户要求 AI 生成动态 React 插件代码
- **THEN** AI 拒绝超出边界的加载方式，并改用固定槽位和静态 renderer registry 约定

### Requirement: 验证流程
模板和 AI 工作流 SHALL 要求在交付前验证 manifest、发现、重复 ID、失败隔离、兼容行为和相关 UI 槽位。

#### Scenario: 验证通过
- **WHEN** 插件的协议和验收测试均通过
- **THEN** 工作流报告插件可按所声明来源安装或加载

#### Scenario: 验证失败
- **WHEN** 任一必需验收测试失败
- **THEN** 工作流报告失败项并阻止将插件标记为完成
