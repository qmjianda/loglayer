## 1. ATDD 验收测试先行（红）

- [x] 1.1 新增 `tests/unit/test_webview_removal.py`：断言 `backend/main.py` 与 `backend/bridge/` 源码中不存在 `import webview`（AST/grep 级检查），且在 `sys.modules` 中屏蔽 `webview` 后 `import backend.main` 不报错
- [x] 1.2 新增探测端点测试：屏蔽 `webview` 模块后启动 TestClient，`GET /api/has_native_dialogs` 返回 `false`（对应 shell-file-picker-contract "无壳环境下探测"/"不依赖 webview" 场景）
- [x] 1.3 新增插槽降级测试：未注入窗口对象且无 tkinter 时，`bridge.select_files()` 返回 `"[]"`、`select_folder()` 返回 `""`，不抛异常（对应插槽保留场景 1）
- [x] 1.4 新增插槽注入测试：向 `bridge.window` 注入具备 `create_file_dialog(kind, allow_multiple, file_types)` 的假对象，`select_files()`/`select_folder()` 走该对象并返回其结果（对应场景 2，kind 为整数 0/1 约定）
- [x] 1.5 运行 `python3 -m pytest tests/unit/test_webview_removal.py` 确认全部失败（红），失败原因正确（行为未实现）

## 2. 后端 webview 移除（绿）

- [x] 2.1 `backend/main.py`：删除顶部 `import webview`；删除 `if not args.no_ui:` 窗口创建分支（`webview.create_window`/`bridge.window = window`/`webview.start`），保留 `--no-ui` flag 为 no-op；`else` 分支的保活循环成为唯一运行路径；启动时打印访问 URL 提示（www 存在→`http://127.0.0.1:{port}`，否则→vite:3000 提示）
- [x] 2.2 `backend/bridge/file_bridge.py`：删除顶部 `import webview`；`select_files()`/`select_folder()` 的 webview 分支改为鸭子类型调用 `self.window.create_file_dialog(...)`（整数 0=OPEN、1=FOLDER），保留 tkinter 兜底与空结果返回
- [x] 2.3 `backend/bridge/utils.py`：删除 `select_window_icon()`；同步删除 `tests/unit/test_window_icon.py`
- [x] 2.4 运行 1.x 全部验收测试确认转绿；运行全量 `python3 -m pytest` 确认无回归（168+ 通过）

## 3. 依赖与打包收敛

- [x] 3.1 `requirements.txt`：移除 `pywebview`
- [x] 3.2 `tools/package_offline.py`：`check_dependencies()` required 列表移除 `webview`；PyInstaller 命令移除 `--windowed`
- [x] 3.3 全局残留检查：`grep -rn "webview" backend/ tools/ --include="*.py"` 确认仅剩注释/文档引用，无 import 与运行时依赖

## 4. 前端与文档同步

- [x] 4.1 确认前端无需改动：`hasNativeDialogs()`/`openRemotePicker` 分流行为已满足新 specs（跑 `npm test` 验证 useFileActions 双路径单测仍绿）
- [x] 4.2 `DEPLOY.md`：删除 webkit2gtk/WebView2 系统依赖安装段；启动说明统一为服务模式（`python backend/main.py` 或 `--no-ui`，标注 flag 已 no-op）
- [x] 4.3 `README.md`：快速开始中移除 pywebview 相关描述与 `--no-ui` 双终端表述，统一为"后端服务 + 浏览器访问"
- [x] 4.4 `AGENTS.md`：开发命令段更新 `--no-ui` 说明（唯一入口、flag 兼容保留），移除"桌面壳 pywebview"架构图描述

## 5. 端到端验证

- [x] 5.1 干净环境冒烟：`pip uninstall pywebview`（或重建 venv 仅装 requirements.txt）后 `python backend/main.py --no-ui` 启动成功，`/api/has_native_dialogs` 返回 false，浏览器打开 12345 端口可正常加载 UI 与打开日志
- [x] 5.2 质量门槛全绿：`ruff check backend tests`、`python3 -m pytest`、`npm run build && npm run lint && npm test` 全部通过
- [x] 5.3 离线打包验证：`python tools/package_offline.py` 产物完整（rg 双平台、无启动脚本回归），未装 pywebview 的环境可启动产物
