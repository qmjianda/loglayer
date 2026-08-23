## Purpose

定义受信任 Python 插件的稳定协议，使插件可以声明能力、被校验并在失败时隔离。

## ADDED Requirements

### Requirement: 插件 manifest 与能力声明
插件 SHALL 提供可校验的 manifest，包含唯一插件 ID、版本、兼容的 LogLayer API 版本和所声明的能力。能力至少可区分 FILTER、TRANSFORM、RENDERING 和 UIWidget。

#### Scenario: 接受完整 manifest
- **WHEN** 加载一个包含唯一 ID、版本、API 兼容范围和能力声明的 manifest
- **THEN** 系统接受 manifest 并将其能力加入插件注册流程

#### Scenario: 拒绝不完整 manifest
- **WHEN** 加载缺少唯一 ID 或版本的 manifest
- **THEN** 系统拒绝该插件并记录可诊断的校验失败

### Requirement: Hook 与注册边界
插件 SHALL 通过标准 Hook 协议和注册门面贡献能力，不得依赖扫描任意 Python 文件来推断插件。MVP 将插件视为受信任 Python 代码，不提供进程沙箱或安全隔离。

#### Scenario: 受信任插件执行 Hook
- **WHEN** 已通过 manifest 校验的插件注册 Hook
- **THEN** 系统调用其声明的 Hook，并允许其贡献声明的能力

#### Scenario: 插件异常被隔离
- **WHEN** 插件 Hook 在发现或执行期间抛出异常
- **THEN** 该插件被标记失败并记录错误，其余插件和应用继续运行

#### Scenario: 不承诺沙箱
- **WHEN** 用户查看 MVP 插件运行边界
- **THEN** 文档明确插件运行在应用进程内且是受信任 Python 代码，不声称提供沙箱

### Requirement: 重复与版本行为确定
插件 ID 和能力 ID SHALL 按确定规则处理重复和不兼容版本。重复 ID 不得产生依赖加载顺序的结果。

#### Scenario: 重复插件 ID
- **WHEN** 两个来源提供相同插件 ID
- **THEN** 系统按固定来源优先级选择一个并记录被跳过的来源，或拒绝该 ID 的全部候选，但不得随机选择

#### Scenario: 不兼容 API 版本
- **WHEN** 插件声明的 API 版本范围不包含当前应用版本
- **THEN** 系统跳过该插件并记录不兼容原因
