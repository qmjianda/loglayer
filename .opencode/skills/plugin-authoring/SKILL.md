# LogLayer 插件编写技能

## 用途

当用户要求新增、迁移或安装 LogLayer 插件时，按本文档生成一套可审核、可测试
的后端插件产物。输出必须符合 `docs/LAYER_DEV_GUIDE.md`，并使用项目实际 API：
`plugin_contract.py`、`plugin_discovery.py`、`plugin_hooks.py`、`plugin_loader.py`
和 `RegistryFacade`。

## 交付清单

先确认插件属于哪一类：

- `FILTER`，后端决定日志行是否保留。
- `TRANSFORM`，后端修改日志内容或结构。
- `RENDERING`，只使用前端已有静态 renderer 计算高亮片段或行样式。
- `UIWidget`，只挂载到 `sidebar`、`inspector`、`statusbar`、`editor_toolbar`。

生成或更新以下内容：

1. `loglayer.plugin.json`，包含稳定 `id`、`name`、`version`、`api_version`、
   `capabilities`，以及需要时的 `ui_slots` 和 `config_schema`。
2. Python 插件模块，通过 `loglayer.plugins` entry point 暴露插件对象或注册函数。
3. `pyproject.toml` 的 entry point 配置，例如：
   `[project.entry-points."loglayer.plugins"]`。
4. 使用 `RegistryFacade` 的注册逻辑，不直接改全局注册表。
5. manifest、发现、加载、重复 ID、版本不兼容、失败隔离和实际行为测试。
6. 源码包或 wheel 的安装说明。若目标是 EXE，说明对应版本要求和受支持的插件
   目录或安装器流程，不指导用户修改 EXE 内部文件。

## 生成规则

- 先阅读现有变更上下文和 `docs/LAYER_DEV_GUIDE.md`，再写代码或文档。
- 保持 `FILTER`、`TRANSFORM`、`RENDERING`、`UIWidget` 的职责边界，不把后端处理
  伪装成前端扩展。
- 使用 `plugin_contract.py` 的契约进行校验，使用 `plugin_discovery.py` 发现，
  使用 `plugin_loader.py` 加载，并通过 `plugin_hooks.py` 接入生命周期。
- 配置必须可序列化。渲染能力只能引用静态 renderer 和固定配置结构。
- 新增或迁移行为必须有最小测试和清晰的安装、卸载、版本兼容说明。

## 必须拒绝的承诺

如果用户要求以下能力，必须明确拒绝或改写为受支持的方案：

- 任意 React、JavaScript 或远程前端模块加载。
- 任意页面、路由或 UI 位置注入。
- 通过 manifest、Pluggy 或 EXE 声称实现沙箱、权限隔离或不可信代码安全执行。
- 把插件描述成独立于应用进程的安全环境。

外部插件是受信任的进程内 Python 代码，可能访问应用拥有的文件、网络、环境变量
和其他 Python 能力。安装说明必须提醒用户审核来源和依赖。若用户确实需要运行
不可信代码，应建议独立进程或操作系统级隔离，并说明这不属于当前插件系统。

## 输出前检查

- manifest 文件名是否为 `loglayer.plugin.json`。
- entry point 组是否为 `loglayer.plugins`。
- UI 插槽是否只使用四个固定值。
- 是否区分后端 `FILTER`、`TRANSFORM` 与前端 `RENDERING`、`UIWidget`。
- 是否包含测试和安装说明。
- 是否没有任意前端插件或沙箱承诺。
