# LogLayer 最小插件模板

复制本目录作为插件起点，按需修改：

1. `loglayer.plugin.json`：改 `id`（全局唯一）、`name`、`version`、能力声明。
2. `plugin.py`：实现你的图层逻辑；工厂函数接收 config 并返回带
   `filter_line` / `process_line` 的实例。
3. `tests/test_template.py`：随模板提供协议验收测试，复制后保留并通过。

## 安装方式

- 开发环境外部目录：把整个目录放入 `examples/plugins/`（源码模式默认扫描）或
  Frozen EXE 同级 `plugins/`。
- 正式分发：在 `pyproject.toml` 声明 entry point 后 `pip install .`：

  ```toml
  [project.entry-points."loglayer.plugins"]
  my_plugin = "my_package.plugin:plugin"
  ```

## 边界提醒

- 插件是应用进程内受信任 Python 代码，无沙箱；发布前审核依赖。
- UI 只能用固定槽位（sidebar / inspector / statusbar / editor_toolbar）和
  应用内已注册的静态 renderer，不能加载任意 React/JS。
