## Why

LogLayer 当前通过扫描 `.py` 文件和检查基类来发现插件，插件目录依赖当前工作目录，导致开发环境、PyInstaller EXE 和外部插件安装方式不一致。图层、UIWidget、layout 槽位也没有统一的扩展契约，AI 生成插件难以按照稳定标准开发和验证。

现在统一插件协议，可以在不破坏现有图层与前端渲染架构的前提下，提供标准 Python 插件包、EXE 外置插件目录和可验证的插件开发流程。

## What Changes

- 引入基于 `pluggy` 的 LogLayer 插件 Hook 协议和注册门面。
- 使用 Python `importlib.metadata` Entry Points 发现已安装插件，插件组固定为 `loglayer.plugins`。
- 增加 manifest 驱动的外部插件目录加载，支持开发环境和 PyInstaller onedir EXE 同级 `plugins/` 目录。
- 统一 Filter、Transform、Rendering、UIWidget 的注册、元数据、错误隔离、重复 ID 和版本兼容规则。
- 移除全部旧式插件兼容层：删除 `DataProcessingLayer`、`BaseLayer`、`NativeLayer`、`PluginLayer` 旧基类别名、`.py` 散文件扫描适配器和 `PYTHON_*/WIDGET_*` 冻结 ID。新插件一律使用 manifest + Hook，内置图层与插件能力共用同一注册记录模型。
- 将插件 UI 限定为固定 sidebar、inspector、statusbar、editor toolbar 等槽位；继续使用静态前端 renderer registry，不加载任意 React 代码。
- 增加插件开发文档、示例和 `plugin-authoring` AI 技能，用于生成 manifest、插件代码和验收测试。
- 明确插件是受信任 Python 代码；本次不提供进程沙箱或安全隔离。

## Capabilities

### New Capabilities

- `plugin-contract`: 定义 pluggy Hook、插件 manifest、能力声明、版本和错误处理契约。
- `plugin-discovery`: 定义 Entry Points、外部开发目录和旧插件兼容发现规则。
- `external-plugin-loading`: 定义 EXE 同级及用户插件目录、路径解析和 reload 行为。
- `layer-registry-compatibility`: 统一现有图层与 UIWidget 注册，同时保持旧基类和元数据行为。
- `frontend-plugin-slots`: 定义固定 UI 槽位、后端插件元数据消费和静态渲染边界。
- `plugin-authoring-workflow`: 定义插件开发文档、AI 技能、模板和验证流程。

### Modified Capabilities

- `layer-system-v2`: 增加标准插件图层注册方式，但不改变渲染层由前端执行的既有边界。
- `offline-packaging-rg`: 增加 PyInstaller onedir 外部插件目录约定，不改变 ripgrep 打包行为。

## Impact

- 后端：`backend/loglayer/` 插件协议、注册表、manifest 和发现逻辑；`backend/bridge/file_bridge.py`、`backend/main.py` 的插件初始化和 API。
- 前端：图层注册元数据、固定 UIWidget 槽位和静态 renderer registry 的类型契约。
- 打包：`tools/package_offline.py`、`LogLayer.spec` 及部署文档。
- 依赖：新增成熟的 `pluggy` Python 依赖。
- 测试：新增插件契约、发现、兼容、外部目录和冻结路径模拟测试；实现前按 ATDD 先运行红测试。
- 并行变更：不修改现有 `ai-assistant-features` 变更；若未来合并时共同触碰 `backend/main.py`，按语义合并两套路由初始化。
