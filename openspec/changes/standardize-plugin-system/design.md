# LogLayer 标准插件系统技术设计

## 1. 设计目标与边界

本设计把插件生命周期统一为一条后端管线：发现候选、读取并校验 manifest、检查 LogLayer API 兼容性、加载入口、执行 pluggy 注册 Hook、提交到统一注册门面。现有图层执行边界保持不变。

明确不做以下事情：

* 不在 MVP 中提供进程沙箱、权限模型或安全隔离。插件是应用进程内运行的受信任 Python 代码。
* 不让前端从插件目录、manifest 或网络动态导入 React、JavaScript 或 TypeScript。
* 不提供任何散文件扫描通道。发现只认 manifest 与 entry point；无 manifest 的 Python 文件不执行、不注册。
* 不让插件自行声明执行引擎。引擎由图层类别和现有 `stage` 规则派生。

现有实现的关键事实是：`backend/loglayer/core.py` 定义 `DataProcessingLayer`、`RenderingLayer`、`UIWidget` 及兼容别名，`registry.py` 同时保存内置图层和插件图层，`FileBridge.sync_layers()` 把处理层交给后端 PipelineWorker，而 `sync_decorations()` 只更新渲染配置。前端 `frontend/src/rendering/registry.ts` 已提供静态 renderer registry 和 `renderWithIsolation()`。新设计把这些行为收拢到稳定门面，而不是重写执行引擎。

## 2. 总体架构

```text
┌──────────────────────┐
│ 应用启动 / reload     │
└──────────┬───────────┘
           ▼
┌────────────────────────────────────────┐
│ PluginDiscovery                         │
│ 1. 已安装 entry points                  │
│ 2. 应用外部 plugins/                    │
│ 3. 用户插件目录                         │
└──────────┬─────────────────────────────┘
           │ 候选 + 来源 +入口
           ▼
┌────────────────────────────────────────┐
│ ManifestLoader                          │
│ Pydantic 模型、API 版本、能力与槽位校验 │
└──────────┬─────────────────────────────┘
           │ 已验证候选
           ▼
┌────────────────────────────────────────┐
│ Pluggy PluginManager                    │
│ hookspec: register(registry_facade)     │
│ plugin:   @hookimpl register(...)       │
└──────────┬─────────────────────────────┘
           ▼
┌────────────────────────────────────────┐
│ RegistryFacade                          │
│ layers / widgets / renderer metadata    │
│ 原子提交、重复处理、失败记录            │
└───────┬───────────────────────┬────────┘
        │                       │
        ▼                       ▼
┌───────────────┐       ┌──────────────────┐
│ FileBridge     │       │ REST metadata API │
│ create layer   │       │ registry/widgets │
└──────┬────────┘       └────────┬─────────┘
       ▼                         ▼
┌───────────────┐       ┌──────────────────┐
│ backend layer  │       │ static frontend  │
│ pipeline       │       │ renderer/slots   │
└───────────────┘       └──────────────────┘
```

### 2.1 模块职责

建议在 `backend/loglayer/` 下新增以下边界。具体文件名可按实现阶段调整，但职责不得合并回扫描式 `registry.py`。

* `plugin_contract.py`：manifest、能力类型、固定槽位、API 版本和诊断结果的类型模型。
* `plugin_hooks.py`：pluggy `PluginSpec`、固定 hook 名称和 hook 参数协议。
* `plugin_discovery.py`：entry point 和外部目录的候选发现。
* `plugin_loader.py`：按候选来源加载模块或包，并把 manifest 与入口绑定。
* `registry.py`：保留现有消费者需要的查询和实例化接口，内部改为 `RegistryFacade`。

`FileBridge` 只负责创建 registry、触发启动发现和显式 reload。它不再拼接 `os.getcwd()/backend/plugins`，也不负责遍历模块成员。`main.py` 继续通过 bridge 暴露 registry 元数据，避免前端直接接触 Python 插件对象。

## 3. Hook 协议与注册门面

### 3.1 pluggy 选择

采用 `pluggy`，因为本需求需要的是小而明确的 Hook 调度协议，而不是插件包安装管理器。pluggy 可以让宿主集中声明 hookspec，让插件通过 `hookimpl` 实现注册，调用、异常处理和测试均可在进程内控制。它不决定插件目录，也不把 Python 模块扫描伪装成发现机制。

不采用 stevedore。stevedore 更偏向 entry point 的加载和 manager 封装，能力注册模型、原子提交、失败状态仍需自行设计，且会把发现和执行边界绑在一起。本项目需要同时支持 entry point 和外部 manifest，使用 `importlib.metadata` 负责发现、pluggy 负责 Hook，更直接。

不采用 Yapsy。Yapsy 以目录插件和自有配置约定为中心，不能自然覆盖已安装发行包的标准 entry point，也不适合与现有图层基类和前端静态 renderer 元数据对接。它还会鼓励回到目录扫描模型，正好违背本变更的发现约束。

### 3.2 Host 与 hookspecs

宿主创建一个专用 `pluggy.PluginManager("loglayer")`，注册 hookspec 后再加载候选。MVP 只定义一个能力注册 Hook，避免让插件绕过门面修改全局状态：

```python
class LogLayerHookSpec:
    @pluggy.HookspecMarker("loglayer")
    def register(self, registry: RegistryFacade, manifest: PluginManifest) -> None:
        """插件通过 registry 注册声明的能力。"""
```

插件入口必须返回一个带 `@hookimpl` 的对象，或返回可被 pluggy 注册的模块对象。插件不得直接调用旧的全局 registry。宿主在调用前创建本插件专属的 staging facade，Hook 成功后才把 staging 内容一次性提交到主 registry。

Hook 协议不暴露 FastAPI app、`FileBridge`、线程池或前端代码。Filter 和 Transform 的实现对象通过能力描述绑定到现有后端类或工厂，Rendering 和 UIWidget 只注册后端元数据及必要的后端数据工厂。

### 3.3 RegistryFacade 数据模型

主 registry 分为四类命名空间：`FILTER`、`TRANSFORM`、`RENDERING`、`UIWidget`。每条能力记录至少保存：

```text
CapabilityRecord
  capability_id: 稳定的全局能力 ID
  plugin_id: 所属插件 ID
  capability_type: FILTER | TRANSFORM | RENDERING | UIWidget
  version: 能力版本
  display_name / description / icon
  category / stage / derived_engine
  ui_schema: 声明式配置 schema
  factory: 后端受信任 Python 工厂（内置为类，插件为工厂函数）
  renderer_id: 仅 RENDERING 或 UIWidget 元数据使用
  slot: 仅 UIWidget 使用
```

能力 ID 使用插件命名空间，推荐 `<plugin_id>:<local_id>`。同一个插件内重复能力 ID 立即失败，不能部分覆盖。内置图层以 `builtin` 来源标识直接进入同一记录模型，外部能力不得覆盖内置 ID。不存在任何冻结的旧式 ID。

门面提供 `register_layer()`、`register_widget()` 和只读查询方法。每次注册先校验类型、ID、版本和槽位，再写入 staging。任意一项失败都只丢弃该项，Hook 的其余合法项仍可提交，但一个插件的 manifest、Hook 或入口失败会使该插件整体失败。提交采用复制或替换方式，不修改已生效的 record。

## 4. Manifest 形状与入口

manifest 是加载边界，必须在执行插件入口前解析并校验。建议采用 JSON 文件，外部目录文件名固定为 `loglayer.plugin.json`，已安装插件则由 entry point 对象提供同等的 `manifest` 属性或 `get_manifest()`。两种来源最终都转换为同一个 `PluginManifest` 模型。

```json
{
  "id": "acme.redaction",
  "name": "Redaction",
  "version": "1.0.0",
  "api": ">=1.0,<2.0",
  "entry": "acme_redaction.plugin:plugin",
  "capabilities": [
    {
      "id": "mask-secrets",
      "type": "TRANSFORM",
      "version": "1.0.0",
      "display_name": "Mask secrets",
      "ui_schema": {"type": "object", "properties": {}}
    },
    {
      "id": "secret-count",
      "type": "UIWidget",
      "version": "1.0.0",
      "slot": "statusbar",
      "renderer_id": "builtin.metric"
    }
  ]
}
```

`id`、`version`、`api`、`entry`、`capabilities` 是必填项。能力类型采用协议大写值，内部映射到现有 `LayerCategory` 字符串。UIWidget 必须有固定 `slot` 和已知 `renderer_id`。RENDERING 的 `renderer_id` 只表示前端已有 renderer，不表示插件可以提供前端代码。

API 兼容范围使用 PEP 440 版本规范，当前宿主 API 版本由后端单一常量提供。范围不包含当前版本的候选在执行入口前跳过，并形成 `incompatible_api` 诊断。

## 5. 发现、来源和确定性

### 5.1 固定发现顺序

来源优先级从高到低固定为：

1. 用户插件目录。
2. 应用或 EXE 同级 `plugins/` 目录。
3. 开发环境显式配置的外部目录，若与应用目录是同一路径则去重。
4. 已安装发行包的 `loglayer.plugins` entry point。
5. 内置图层和内置 renderer 作为最低优先级的宿主能力，不参与外部插件 ID 竞争。

为避免环境差异，实际候选先按来源优先级排序，再按规范化绝对路径排序，最后按 entry point 的名称排序。重复插件 ID 只选择排序最前的候选，其余候选记录 `duplicate_plugin_id`，不会依赖 metadata 返回顺序。能力 ID 冲突遵循同一来源优先级，但一个候选内部的重复能力直接使该插件失败。

### 5.2 已安装 entry point

调用 `importlib.metadata.entry_points(group="loglayer.plugins")`，只处理固定组。其他组一律忽略。每个 entry point 的 `load()` 只在 manifest 基础字段已取得并通过初步校验后调用。入口加载异常只标记该候选失败，继续其他候选。

entry point 的值是插件的 Python 入口对象，不承担能力枚举。manifest 是唯一能力声明来源，Hook 注册结果必须是 manifest 所声明能力的子集，不允许 Hook 偷带未声明能力。

### 5.3 外部目录

每个外部插件占一个目录，必须有 `loglayer.plugin.json`。入口模块相对于该目录解析，模块导入使用唯一的内部模块名，例如 `loglayer_external_<sha256(realpath)>`，避免不同目录同名模块污染 `sys.modules`。不扫描目录中其他 `.py` 文件，也不执行没有 manifest 的文件。

路径在进入发现器时转为规范化绝对路径并去重。开发环境目录来自显式配置或测试注入，不依赖当前工作目录。冻结应用目录来自 EXE 所在目录，而不是 `sys._MEIPASS` 或当前工作目录。

### 5.4 PyInstaller onedir 与开发环境的差异

PyInstaller onedir 会把应用代码和依赖收进冻结目录，entry point 元数据不应假设仍可像普通 virtualenv 一样发现。内置插件随应用一起打包并由宿主显式注册，外部插件则从 `Path(sys.executable).parent / "plugins"` 读取 manifest 和源码。外部插件所需依赖必须在应用 Python 环境或插件自身可导入路径中可用，MVP 不做依赖安装器。

开发环境的 installed entry point 由当前 Python 环境的 `importlib.metadata` 提供，外部目录由配置提供。两者共享同一 manifest、Hook 和 registry 流程。`tools/package_offline.py` 只需保证 onedir 产物旁可创建 `plugins/` 目录，不把用户外部插件混入冻结内部代码，也不改变包内 `bin/linux/rg` 与 `bin/windows/rg.exe` 的选择逻辑。

## 6. 失败隔离与诊断

失败隔离分为三层：

```text
manifest 失败 ─────┐
入口 import 失败 ──┼─> 候选 FAILED，不影响其他插件
Hook 失败 ─────────┘

能力元数据失败 ─────> 丢弃该能力，提交其他合法能力

后端实例化失败 ────> 当前图层不可用，Pipeline 保持应用级可运行
前端 renderer 失败 ─> 当前 widget/layer no-op，其他 UI 保持可用
```

每条失败记录至少包含 `plugin_id`（若 manifest 可读）、来源、阶段、异常类型、稳定错误代码和简短消息。异常堆栈仅写诊断日志，不通过 API 返回。插件状态为 `discovered`、`registered`、`failed`、`disabled` 之一，状态快照供诊断接口和 reload 返回值使用。

插件运行在主进程，因此异常捕获只用于隔离和报告，不构成安全边界。插件故意退出进程、修改文件或访问网络均属于受信任代码的责任范围，文档必须明确这一点。

## 7. Reload 生命周期

reload 是显式动作，不做文件监视。一次 reload 使用新的 staging registry 和新的候选快照，顺序如下：

```text
旧 active registry
        │
        ├─ 保存内置能力和未受影响的 session 配置
        ▼
清理外部候选模块缓存
        ▼
重新发现、校验、加载、Hook、构建 staging
        ▼
原子替换 external records
        ▼
重新建立受影响图层的可实例化索引
        ▼
每个打开 session：移除失效实例，重建仍启用实例
        ▼
处理层触发 sync_layers，渲染层清缓存并走 sync_decorations 语义
```

reload 前保留内置 registry，不清除内置能力。外部插件记录按插件 ID 全量替换，因此旧能力 ID 不会残留。导入模块从 `sys.modules` 删除本次外部模块的内部名字后重新导入。不能安全卸载第三方模块的全局副作用，故 reload 的承诺是 registry 和实例生命周期无旧记录，不承诺撤销任意 Python 全局副作用。

若新版本 manifest 或入口失败，该插件变为 `failed` 并从 active registry 移除，其他插件继续使用。打开文件中引用失效能力的配置保留原始配置但不创建实例，返回可诊断错误；成功 reload 后，重新同步 session，避免旧实例继续持有旧类或旧配置。

## 8. 内置图层统一注册

内置图层不是插件，不经过 manifest 发现：它们随应用代码编译打包，在 registry 初始化时直接以 `builtin` 来源写入同一记录模型。查询、实例化、engine 派生和元数据输出对内置与插件能力只有一条路径。

```text
registry 初始化
        │
        ├─ 内置图层类 ──直接──> CapabilityRecord(plugin_id="builtin")
        │
        └─ discovery 结果 ─staging/commit─> CapabilityRecord(plugin_id=<manifest id>)
                                    │
                     commit 时统一查重：外部 ID 不得覆盖 builtin 或其他插件
```

`UIWidget` 能力允许声明可选的 `data_provider`（受信任 Python 可调用对象），供 `/api/get_widget_data` 返回实时数据；视觉呈现仍由前端静态 renderer 按声明式配置完成。示例插件随仓库放在 `examples/plugins/demo-plugin/`，使用标准 manifest 格式，同时作为开发环境默认外部目录和 EXE 打包预置内容。

## 9. 现有图层执行边界

```text
前端 layers_json
        │
        ▼
FileBridge.sync_layers()
        │
        ├─ FILTERING / TRANSFORM
        │       │
        │       ▼
        │   create_layer_instance()
        │       │
        │       ▼
        │   PipelineWorker
        │   native 阶段走 ripgrep，logic 阶段走 Python
        │
        └─ RENDERING
                │
                ▼
            仅发送/保存配置
                │
                ▼
            前端静态 renderLayers()
```

注册门面必须把 `category` 映射到现有 `LayerCategory`，并调用 `derive_engine(category, stage)`。RENDERING 永远派生为 `frontend`，后端不调用其 `highlight_line()` 或 `get_row_style()`。FILTERING 和 TRANSFORM 继续由后端执行，native 仅对现有可表达的 native layer 使用 ripgrep。插件注册只是增加工厂和元数据，不改变 PipelineWorker 的输入输出或 session 的 `layer_instances`、`rendering_instances` 分离。

后端 registry API 返回统一元数据，前端不需要知道工厂类。`get_layer_registry` 保持现有 API 入口，新增字段采用向后兼容方式；`get_ui_widgets` 返回固定槽位和 renderer ID。

## 10. 前端固定槽位与静态 renderer

前端继续以 `frontend/src/rendering/registry.ts` 为唯一 renderer 注册点。后端返回的是可 JSON 序列化的 `WidgetMetadata`，至少包含 `id`、`plugin_id`、`slot`、`renderer_id`、`config`、显示信息和可选刷新间隔。

允许的槽位固定为 `sidebar`、`inspector`、`statusbar`、`editor_toolbar`。前端在边界解析后以穷举分支路由槽位，未知槽位直接报告元数据错误。`renderer_id` 必须在静态 registry 中存在，未知 renderer 直接跳过。渲染调用复用现有 `renderWithIsolation()` 的单项 no-op 降级，不添加从目录导入组件的路径。

```text
GET /api/get_ui_widgets
          │
          ▼
typed WidgetMetadata[]
          │
          ├─ slot=sidebar       ─> SidebarView
          ├─ slot=inspector     ─> InspectorDock
          ├─ slot=statusbar     ─> StatusBar
          └─ slot=editor_toolbar─> EditorToolbar
                       │
                       ▼
             static renderer registry
                       │
          unknown/error ─┴─> widget-local no-op
```

需要插件独特视觉时，插件作者必须先选择一个应用已登记的静态 renderer。若确实需要新的 renderer，先修改应用前端 registry、类型和测试，再由后端 manifest 引用其稳定 ID。这样 renderer 是应用发布物的一部分，而非插件运行时下载物。

## 11. 路径解析与打包集成

路径解析器接受运行模式、可选配置目录、可选用户目录和可选 executable path，不读取当前工作目录作为事实来源。规范化后返回有序 `PluginSource`：

```text
开发模式:
  configured external dirs -> application plugin dir -> user dir -> entry points

PyInstaller onedir:
  Path(sys.executable).parent / plugins -> user dir -> entry points if available
```

为符合固定优先级，应用目录优先于 entry point，用户目录优先于应用目录。应用和用户目录同 ID 时选择用户目录并记录冲突。缺失目录是空来源，不是启动错误。

`package_offline.py` 的设计责任只有打包时保留外部目录约定和包内资源。PyInstaller 的 `--add-data` 不能把用户日后放入 EXE 同级的插件当作构建期 data，因此不把外部插件内容打入 exe。应用启动时创建或容忍缺失的同级 `plugins/`。ripgrep 定位继续使用应用既有的包内 `bin` 逻辑，插件发现失败或 rg 权限告警互不影响。

## 12. Plugin authoring 文档和 skill

项目提供插件开发指南、最小包模板和外部目录模板。模板包含：manifest、入口模块、最小 Hook、一个能力示例、安装方式、外部目录布局和验收测试骨架。指南必须明确固定 UI 槽位、静态 renderer、API 版本和受信任 Python 限制。

`plugin-authoring` skill 的流程固定为：

1. 先询问能力类型和所需 UI 槽位。
2. 拒绝任意 React 动态加载请求，改为固定槽位和静态 renderer ID。
3. 生成 manifest、最小插件代码和来源说明。
4. 为 manifest、发现、重复 ID、失败隔离、API 兼容和用户声明的行为生成验收测试。
5. 执行协议验证并报告可安装或可外部加载的来源。任何必需测试失败都不能报告完成。

skill 只生成符合本设计的 Python 插件，不承诺沙箱，也不生成隐藏的 import side effect 或绕过 registry facade 的代码。

## 13. 测试 seams

所有新逻辑以可注入依赖切开，测试不依赖真实当前工作目录、真实用户目录或真实 PyInstaller 进程：

| seam | 注入内容 | 必测行为 |
| --- | --- | --- |
| `PluginDiscovery` | `importlib.metadata` provider、目录列表、路径解析器 | 固定组、排序、去重、缺失目录、普通 `.py` 忽略 |
| `ManifestLoader` | JSON 文本、API 版本、入口解析器 | 必填字段、能力类型、槽位、兼容范围 |
| `PluginLoader` | module loader、module cache | 入口异常、唯一模块名、reload 重新导入 |
| `RegistryFacade` | 空 registry、staging registry | 重复插件和能力、原子提交、无部分覆盖 |
| pluggy host | fake plugin objects | Hook 成功、Hook 异常、声明能力子集 |
| path resolver | `frozen`、fake executable、configured dirs | 任意 cwd 下 EXE 同级目录、优先级和绝对路径 |
| 内置注册 | registry 实例 | builtin 记录可查、外部不得覆盖内置 ID、实例化语义不变 |
| `FileBridge` | fake registry 和 session | 处理层进入 pipeline、渲染层不进 pipeline、reload 后实例替换 |
| REST metadata | fake bridge registry | JSON 形状、失败插件诊断、UI metadata 消费 |
| frontend registry | static renderer map、metadata fixtures | 固定槽位、未知 renderer、renderer 异常局部降级 |
| package inspection | 临时 onedir tree | 同级 plugins 发现、缺目录正常启动、双平台 rg 不受影响 |

测试层次为：

* 单元测试覆盖模型、排序、版本、registry 原子性和统一内置注册。
* 后端集成测试用临时目录和真实 `importlib.metadata` 分发元数据，确认 installed entry point 走完整流程。
* API 集成测试确认 `get_layer_registry` 和 `get_ui_widgets` 只返回声明式数据。
* 前端单元测试覆盖每个固定槽位和静态 renderer 错误隔离。
* 最少一个 E2E 场景从外部插件目录加载一个 Filter 或 Transform，并观察日志可见行或转换内容；另一个场景确认未知 UI renderer 不下载或执行插件 React 代码。

每个测试按 Given、When、Then 组织，并断言机器可观察的状态、类型、ID 和结果，不断言无关的日志文案。reload 测试必须验证旧 capability 不残留，不能只验证 `reload()` 返回 True。

## 14. 迁移策略

### 阶段一，先建契约和统一门面

加入 `pluggy` 依赖、manifest 模型、hookspec、RegistryFacade 和诊断类型。内置图层与插件能力从第一天起共用同一记录模型，不保留旧查询分轨。

### 阶段二，接入新发现路径

在 `FileBridge` 初始化时创建路径解析器和统一 discovery。默认加载 installed entry points、外部 manifest 和内置能力。发现只认 manifest 与 entry point；仓库示例插件使用标准 manifest 格式放在 `examples/plugins/`。

### 阶段三，接入 reload 和 API

将现有 `reload_plugins()` 改为 staging reload，返回失败诊断并重建打开 session 的实例。保留 `/api/get_layer_registry`、`/api/get_ui_widgets`，把源信息、版本和 renderer metadata 以新增字段提供。不得让前端依赖 Python 类名。

### 阶段四，固定前端边界和 authoring workflow

把 UIWidget 元数据接入 SidebarView、InspectorDock、StatusBar 和 EditorToolbar 的现有组合点。renderer 继续静态注册，补类型和测试。加入文档、模板与 `plugin-authoring` skill，并用一个真实样例完成安装和外部目录两种验证。

### 阶段五，清理遗留兼容

删除 `DataProcessingLayer` 等旧基类别名、`LegacyPluginAdapter` 散文件扫描与 `PYTHON_*/WIDGET_*` 冻结 ID，移除 `backend/plugins/` 旧目录。整个过程中，`sync_layers()`、`sync_decorations()`、PipelineWorker 和 ripgrep 资源路径保持现有语义。

迁移完成的判据是：内置图层与标准插件都能从同一 registry 记录查询，重复和失败结果在不同启动目录下相同，PyInstaller onedir 从 EXE 同级目录加载外部插件，前端没有任何任意 React runtime loading 路径。
