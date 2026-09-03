## Purpose

定义与桌面壳实现无关的通用文件/文件夹选择契约：后端以 HTTP 端点暴露选择能力探测与目录浏览，前端按分流约定选择"注入的壳对话框"或"远程路径选择器"，为移除 pywebview 后接入任意桌面壳（Tauri/Electron 等）保留稳定扩展点。

## ADDED Requirements

### Requirement: 选择能力探测端点恒定可用

后端 SHALL 提供 `GET /api/has_native_dialogs` 端点，在未接入桌面壳时恒返回 `false`；接入壳后由壳注入的选择器决定返回值。端点契约不随壳变化。

#### Scenario: 无壳环境下探测

- **WHEN** 后端以纯服务模式运行（未注入任何桌面壳选择器）
- **THEN** `GET /api/has_native_dialogs` 返回 `false`

#### Scenario: 探测端点不依赖 webview

- **WHEN** 运行环境中未安装 `pywebview` 且后端正常启动
- **THEN** `GET /api/has_native_dialogs` 仍可正常响应（返回 `false`），不因缺少 `pywebview` 而报错

### Requirement: 远程目录浏览作为通用选择后端

后端 SHALL 通过既有的 `POST /api/list_directory` 端点提供服务器端目录浏览能力，作为前端远程路径选择器的唯一数据来源；该能力不依赖任何桌面壳。

#### Scenario: 远程选择器浏览目录

- **WHEN** 前端远程路径选择器请求某目录的一级内容
- **THEN** `POST /api/list_directory` 返回该目录下文件与子目录列表（名称、绝对路径、是否目录、大小）

#### Scenario: 浏览不存在的目录

- **WHEN** 远程路径选择器请求一个不存在的目录
- **THEN** 返回空列表或错误信息，后端不崩溃

### Requirement: 无 webview 依赖的后端启动

后端 SHALL 在完全不安装 `pywebview` 的环境中正常启动并提供全部 REST/WS 服务与前端静态托管；启动入口不再提供创建原生窗口的选项。

#### Scenario: 未安装 pywebview 时启动

- **WHEN** 运行环境执行 `pip install -r requirements.txt`（不含 pywebview）后启动后端
- **THEN** 后端正常监听 `--host`/`--port`（默认 127.0.0.1:12345），`backend/www` 存在时挂载前端静态文件

#### Scenario: 服务模式为唯一入口

- **WHEN** 用户以任意参数组合启动后端
- **THEN** 后端均以本地服务形式运行，不尝试创建任何桌面窗口

### Requirement: 文件选择接口的壳插槽保留

后端文件选择实现 SHALL 通过鸭子类型的窗口对象插槽（`bridge.window` 风格）支持未来桌面壳注入原生对话框；插槽为空时 SHALL 回退到 `tkinter`（可用时）或返回空结果，不抛异常。

#### Scenario: 无插槽时调用文件选择

- **WHEN** 未注入壳窗口对象且环境无 `tkinter`
- **THEN** 文件选择 API 返回空列表/空字符串，不抛异常

#### Scenario: 未来壳注入后使用原生对话框

- **WHEN** 某桌面壳启动时注入具备 `create_file_dialog` 能力的窗口对象
- **THEN** 文件选择 API 使用该对象的原生对话框，前端经 `/api/has_native_dialogs` 探测到 `true` 后走原生分支
