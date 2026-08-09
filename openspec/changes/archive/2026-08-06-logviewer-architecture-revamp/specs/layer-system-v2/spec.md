# layer-system-v2 Specification

## Purpose
定义图层协议 v2：图层类别即执行位置（engine 路由），过滤/转换由后端高性能执行，渲染全部由前端执行；后端对渲染层仅保留元数据注册，前端提供渲染器注册表与通用规则引擎，使添加新图层的摩擦最小化。

## ADDED Requirements

### Requirement: 类别即执行位置
系统 SHALL 根据图层类别（FILTERING / TRANSFORM / RENDERING）决定执行位置：FILTERING 与 TRANSFORM 在后端执行，RENDERING 在前端执行，不得要求图层自行声明执行位置。

#### Scenario: 过滤层后端执行
- **WHEN** 启用一个 FILTERING 类别图层
- **THEN** 该图层由后端管线执行（native 走 ripgrep，logic 走 Python），生成可见行集

#### Scenario: 转换层后端执行
- **WHEN** 启用一个 TRANSFORM 类别图层
- **THEN** 该图层由后端逐行执行内容转换，转换后的文本作为前端渲染内容

#### Scenario: 渲染层前端执行
- **WHEN** 启用一个 RENDERING 类别图层
- **THEN** 该图层的视觉计算全部在前端完成，后端不执行其高亮或行样式逻辑

### Requirement: 渲染层仅元数据注册
系统 SHALL 在后端对渲染层仅注册元数据（type、display_name、ui_schema、category、engine），不包含任何逐行执行逻辑；前端通过 `get_layer_registry` 获取元数据生成配置表单。

#### Scenario: 渲染层注册不产生执行代码
- **WHEN** 后端 registry 注册一个渲染层
- **THEN** 该注册仅提供元数据供前端生成配置 UI
- **AND** 后端管线中不存在该图层的逐行计算调用

#### Scenario: 配置表单自动生成
- **WHEN** 前端加载图层注册表
- **THEN** 每个渲染层按其 ui_schema 自动生成配置表单

### Requirement: 前端渲染器注册表
系统 SHALL 提供前端渲染器注册表，将图层 type 映射到渲染函数 `render(content, config)`，渲染函数为纯函数（输入文本与配置，输出 segments 与行样式），可独立测试。

#### Scenario: 渲染器输出高亮段
- **WHEN** 调用渲染函数处理一行文本
- **THEN** 返回该行的高亮段列表与行样式，且结果仅由输入决定（纯函数）

#### Scenario: 渲染器错误隔离
- **WHEN** 某个渲染器执行抛错
- **THEN** 该图层降级为不渲染，其余图层与日志显示不受影响

### Requirement: 通用规则引擎
系统 SHALL 提供通用规则引擎，以规则配置（pattern、action、color 等）表达常见视觉需求；配置规则即新增图层，无需编写代码。

#### Scenario: 规则配置实现高亮
- **WHEN** 添加一条规则 `{pattern: "ERROR", action: "highlight", color: "red"}`
- **THEN** 含 ERROR 的文本段按配置颜色高亮，无需新增渲染器代码

#### Scenario: 规则配置实现行着色
- **WHEN** 添加一条行着色规则
- **THEN** 匹配行按配置的行背景色渲染

### Requirement: 图层添加路径
系统 SHALL 提供清晰的图层添加路径：过滤/转换图层写后端类并注册；渲染图层优先用规则配置，独特视觉才写前端渲染器并注册元数据。

#### Scenario: 添加过滤图层
- **WHEN** 需要新增一个过滤图层
- **THEN** 开发者编写后端过滤类并注册，前端无需改动

#### Scenario: 添加简单视觉图层
- **WHEN** 需要新增一个可被规则表达的视觉图层
- **THEN** 开发者仅添加规则配置，前后端均无需编写代码

#### Scenario: 添加独特视觉图层
- **WHEN** 需要新增一个规则无法表达的视觉图层
- **THEN** 开发者编写前端渲染器并在注册表注册，后端仅注册元数据
