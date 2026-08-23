## Purpose

定义插件 UI 的固定槽位和静态前端渲染边界，避免插件任意加载 React 代码。

## ADDED Requirements

### Requirement: 固定 UI 槽位
系统 SHALL 只支持 sidebar、inspector、statusbar 和 editor toolbar 等预定义槽位。插件 UI 元数据 SHALL 指向静态 renderer registry 中的已知 renderer。

#### Scenario: 渲染固定槽位 widget
- **WHEN** 后端返回合法 widget 元数据且槽位为 sidebar、inspector、statusbar 或 editor toolbar
- **THEN** 前端将 widget 放入对应固定槽位并使用已注册 renderer

#### Scenario: 拒绝任意槽位
- **WHEN** 插件声明未定义的 UI 槽位
- **THEN** 前端不渲染该 widget，并报告元数据错误

### Requirement: 禁止任意 React 加载
前端 SHALL 不从插件目录、manifest 或网络动态导入任意 React 代码；插件只能使用应用预先注册的静态 renderer 和声明式配置。

#### Scenario: 插件提供未知 renderer
- **WHEN** widget 元数据引用未在静态 registry 中登记的 renderer
- **THEN** 前端跳过该 widget，不执行或下载插件提供的 React 代码

#### Scenario: renderer 抛错
- **WHEN** 静态 renderer 渲染插件 widget 时抛出异常
- **THEN** 仅该 widget 降级为不可用，其余 UI 和日志显示继续工作

### Requirement: 后端元数据消费
前端 SHALL 消费后端提供的插件元数据，并以类型安全的声明式配置生成固定槽位内容。

#### Scenario: 加载插件元数据
- **WHEN** 前端收到有效的插件 widget 元数据
- **THEN** 根据其配置在固定槽位渲染，不要求后端传送组件源码
