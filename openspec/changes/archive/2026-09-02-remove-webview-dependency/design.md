## Context

当前 `pywebview` 的耦合点（详见 proposal.md - Impact）集中在三处：

- `backend/main.py:8` 顶部 `import webview`；`start_app()` 中 `if not args.no_ui:` 分支创建窗口、注入 `bridge.window`、调用 `webview.start()`。
- `backend/bridge/file_bridge.py:16` 顶部 `import webview`；`select_files()`/`select_folder()` 的 `webview.FileDialog` 分支。
- `backend/bridge/utils.py:91` `select_window_icon()` 仅服务于 pywebview 窗口创建。

前端已有完整分流抽象（`hasNativeDialogs()` → 原生 / `openRemotePicker`），通信层为 REST + WS，不依赖 `window.pywebview.api`。因此本次是"删默认分支 + 保抽象插槽"，不是架构重构。

约束：

- 用户环境将不再 `pip install pywebview`，代码中任何路径都不得在 import 或运行时强依赖该库。
- `--no-ui` 成为唯一入口，但 CLI 兼容性需平滑：`python backend/main.py` 不带参数也应直接以服务模式启动（不再需要显式 `--no-ui`）。
- 现有测试（pytest 168 + vitest 156）必须保持绿；桌面模式相关单测随行为移除而调整。

## Goals / Non-Goals

**Goals:**

- 后端在无 `pywebview` 环境中零报错启动，`requirements.txt` 不再包含该依赖。
- `bridge.window` 鸭子插槽与 `hasNativeDialogs` 探测契约保留，未来桌面壳可零改动后端接入（注入窗口对象即可切换原生对话框分支）。
- 打包脚本与文档同步收敛为纯服务模式。

**Non-Goals:**

- 不引入任何新桌面壳（Tauri/Electron）或其依赖。
- 不抽象"窗口/托盘/更新"等宽接口——只保留文件选择插槽（YAGNI）。
- 不改变 REST/WS API 的既有契约（`/api/has_native_dialogs`、`/api/select_files`、`/api/list_directory` 端点行为不变）。
- 不重写前端文件选择编排（`useFileActions.ts` 现有分流已满足 specs）。

## Decisions

### D1: 彻底删除 vs 可选依赖（`pip install loglayer[desktop]`）

**选择：彻底删除。**

- 备选 A（可选 extra）：保留 `pywebview; extra == "desktop"`，代码延迟 import。被否——用户明确"pip 不装 webview 库"，且可选路径意味着双分支永久维护、测试矩阵翻倍。
- 备选 B（彻底删除）：`requirements.txt` 移除、代码删净、插槽留白。未来桌面壳按 `shell-file-picker-contract` 契约重新适配，而非复活 pywebview 分支。

### D2: `--no-ui` 参数的兼容处理

**选择：保留 flag 但语义变为 no-op（向后兼容），服务模式为唯一行为。**

- 备选 A（移除 `--no-ui` 参数，缺省即服务）：直接删参数最干净，但会破坏 AGENTS.md、e2e 脚本、CI、用户肌肉记忆中大量 `python backend/main.py --no-ui` 调用点。
- 备选 B（保留参数、接受并忽略）：argparse 仍解析 `--no-ui`，值不再影响行为（恒为服务模式）。调用方零改动，文档同步说明参数已冗余。**选 B。**
- 附带：`--ui` 类反向参数不引入；启动时打印访问 URL 提示（`backend/www` 存在时打印 12345 端口地址，否则提示 vite:3000）。

### D3: `file_bridge.py` 文件选择的降级链

**选择：`bridge.window` 插槽（鸭子类型）→ `tkinter` → 空结果。**

- `hasattr(self, "window")` 分支保留，但内部不再 `from webview import FileDialog`，改为调用注入对象的 `create_file_dialog(OPEN/FOLDER, ...)` 方法（鸭子协议，未来壳需实现该签名）。
- 注意：pywebview 的 `FileDialog` 枚举仅是常量（OPEN=0/FOLDER=1），插槽协议直接用整数或字符串约定，不引入 webview 符号。
- `tkinter` 兜底与空结果路径不变（specs 场景已覆盖）。

### D4: `select_window_icon()` 与 `backend/assets/icon.png` 的去留

**选择：删除函数与调用点，保留 `icon.png` 资源文件。**

- 函数唯一调用方是 pywebview 窗口创建，随分支删除；对应单测 `test_window_icon.py` 移除。
- `icon.png` 保留：README 截图、未来壳、打包元数据仍可能引用。

### D5: 打包脚本收敛

**选择：`tools/package_offline.py` 仅移除 webview 相关处理，不重构。**

- PyInstaller 命令中 `--windowed` 标志移除（纯服务无需隐藏控制台；服务模式需要 stdout 可见）。
- `check_dependencies()` 的 required 列表移除 `webview`。
- 不动其余打包逻辑（rg 双平台拷贝等由 `offline-packaging-rg` spec 看护）。

## Risks / Trade-offs

- [调用方仍传 `--no-ui` 的脚本在语义变化后行为不同（原本带 UI，现在无 UI）] → 该 flag 本就是"无 UI"含义，行为收敛与其字面义一致；在 DEPLOY.md/README 标注 BREAKING；e2e/CI 全部使用 `--no-ui` 或纯服务启动，无受影响调用点（已 grep 验证）。
- [未来壳注入 `bridge.window` 时协议不匹配] → D3 明确鸭子协议签名（`create_file_dialog(kind, allow_multiple, file_types)`，kind 用整数 0/1 约定）；`shell-file-picker-contract` spec 已含注入场景，接入时以契约测试对齐。
- [`import webview` 残留导致未装库环境崩溃] → 实现后全局 grep `webview` 验证仅剩注释/文档引用；CI 在干净环境安装 requirements.txt 并启动冒烟（现有 backend job 已覆盖安装+测试路径）。
- [删除窗口分支后 `start_app()` 的主线程循环变化] → 复用现有 `--no-ui` 的 `while True: sleep` 保活循环，该路径已被 e2e 长期验证。

## Migration Plan

1. 合入后 `pip uninstall pywebview`（或重建 venv）验证启动冒烟。
2. `DEPLOY.md` 删除 webkit2gtk/WebView2 安装段；README 快速开始统一为 `python backend/main.py --no-ui`（或直接 `python backend/main.py`）。
3. 回滚策略：单 commit revert 即可恢复（无数据/格式迁移）。

## Open Questions

- 未来壳接入时 `bridge.window` 协议是否升级为显式 `Protocol` 类（`backend/shell/protocol.py`）：留待桌面需求出现时决定，不影响本次插槽形状（鸭子类型已满足契约测试）。
