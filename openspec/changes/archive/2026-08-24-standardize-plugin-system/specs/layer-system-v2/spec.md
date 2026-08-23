## Purpose

在不改变现有图层执行边界的前提下，为 layer-system-v2 增加标准插件图层注册方式。

## MODIFIED Requirements

### Requirement: 类别即执行位置
原要求：系统 SHALL 根据图层类别（FILTERING / TRANSFORM / RENDERING）决定执行位置：FILTERING 与 TRANSFORM 在后端执行，RENDERING 在前端执行，不得要求图层自行声明执行位置。

原场景：
- **WHEN** 启用一个 FILTERING 类别图层
- **THEN** 该图层由后端管线执行（native 走 ripgrep，logic 走 Python），生成可见行集
- **WHEN** 启用一个 TRANSFORM 类别图层
- **THEN** 该图层由后端逐行执行内容转换，转换后的文本作为前端渲染内容
- **WHEN** 启用一个 RENDERING 类别图层
- **THEN** 该图层的视觉计算全部在前端完成，后端不执行其高亮或行样式逻辑

#### Scenario: 过滤层后端执行
- **WHEN** 启用一个 FILTERING 类别图层
- **THEN** 该图层由后端管线执行（native 走 ripgrep，logic 走 Python），生成可见行集

#### Scenario: 转换层后端执行
- **WHEN** 启用一个 TRANSFORM 类别图层
- **THEN** 该图层由后端逐行执行内容转换，转换后的文本作为前端渲染内容

#### Scenario: 渲染层前端执行
- **WHEN** 启用一个 RENDERING 类别图层
- **THEN** 该图层的视觉计算全部在前端完成，后端不执行其高亮或行样式逻辑

修改后：系统 SHALL 根据图层类别（FILTERING / TRANSFORM / RENDERING）决定执行位置：FILTERING 与 TRANSFORM 在后端执行，RENDERING 在前端执行，不得要求图层自行声明执行位置。标准插件图层必须通过统一注册门面声明类别；该注册不改变执行位置。

#### Scenario: 插件过滤层后端执行
- **WHEN** 启用一个通过标准注册门面声明为 FILTERING 的插件图层
- **THEN** 该图层由后端管线执行并生成可见行集

#### Scenario: 插件渲染层前端执行
- **WHEN** 启用一个通过标准注册门面声明为 RENDERING 的插件图层
- **THEN** 该图层的视觉计算全部在前端完成，后端不执行其逐行视觉逻辑

### Requirement: 图层添加路径
原要求：系统 SHALL 提供清晰的图层添加路径：过滤/转换图层写后端类并注册；渲染图层优先用规则配置，独特视觉才写前端渲染器并注册元数据。

原场景：
- **WHEN** 需要新增一个过滤图层
- **THEN** 开发者编写后端过滤类并注册，前端无需改动
- **WHEN** 需要新增一个可被规则表达的视觉图层
- **THEN** 开发者仅添加规则配置，前后端均无需编写代码
- **WHEN** 需要新增一个规则无法表达的视觉图层
- **THEN** 开发者编写前端渲染器并在注册表注册，后端仅注册元数据

#### Scenario: 添加过滤图层
- **WHEN** 需要新增一个过滤图层
- **THEN** 开发者编写后端过滤类并注册，前端无需改动

#### Scenario: 添加简单视觉图层
- **WHEN** 需要新增一个可被规则表达的视觉图层
- **THEN** 开发者仅添加规则配置，前后端均无需编写代码

#### Scenario: 添加独特视觉图层
- **WHEN** 需要新增一个规则无法表达的视觉图层
- **THEN** 开发者编写前端渲染器并在注册表注册，后端仅注册元数据

修改后：系统 SHALL 提供清晰的图层添加路径：后端过滤/转换图层可作为标准插件注册；渲染图层优先用规则配置，独特视觉才写前端静态渲染器并注册元数据。

#### Scenario: 标准插件添加过滤图层
- **WHEN** 需要新增一个过滤图层
- **THEN** 开发者通过标准插件契约注册后端能力，前端无需改动

#### Scenario: 独特视觉保持静态边界
- **WHEN** 需要新增一个规则无法表达的视觉图层
- **THEN** 开发者注册前端静态 renderer 和后端元数据，不动态加载任意 React 代码
