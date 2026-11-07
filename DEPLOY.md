# LogLayer 部署指南 (Deployment Guide)

本指南介绍如何在不同环境下部署和运行 LogLayer。

## 1. 软件打包 (Packaging)

使用项目提供的 `tools/package_offline.py` 脚本可以生成离线分发包。

### 运行打包脚本
```bash
# 生成基础离线包（包含前端静态文件、后端源码和 ripgrep）
python tools/package_offline.py

# 生成当前构建平台的独立可执行文件（需安装 PyInstaller）
python tools/package_offline.py --exe
```

生成的包位于 `dist_offline/` 目录。

`--exe` 产物与构建平台相关：Windows 和 Linux 需要分别构建。基础离线包可以携带两个平台的
ripgrep，但不能让一个 PyInstaller 可执行文件跨平台运行。

---

## 2. Windows 平台部署

### A. 使用独立可执行文件 (推荐)
1. 进入 `dist_offline/` 目录。
2. 运行 `LogLayer_Standalone/LogLayer.exe`（无需 Python 环境）。
3. 浏览器访问 `http://127.0.0.1:12345`。

### B. 从源码包运行 (需 Python 环境)
1. 进入 `dist_offline/` 目录。
2. 安装依赖：`pip install -r requirements.txt`
3. 启动服务：`python app/main.py --no-ui`（`--no-ui` 为兼容保留的 no-op 参数）。
4. 浏览器访问 `http://127.0.0.1:12345`。

---

## 3. Linux 平台部署

### A. 使用独立可执行文件 (推荐)
1. 进入 `dist_offline/` 目录。
2. 赋予执行权限：`chmod +x LogLayer_Standalone/LogLayer`
3. 运行 `./LogLayer_Standalone/LogLayer`。
4. 浏览器访问 `http://127.0.0.1:12345`。

### B. 从源码包运行 (需 Python 环境)
1. 进入 `dist_offline/` 目录。
2. 安装依赖：`pip install -r requirements.txt`
3. 启动服务：`python app/main.py --no-ui`。
4. 浏览器访问 `http://127.0.0.1:12345`。

> 注：后端已移除 pywebview 桌面壳依赖，无需安装 `webkit2gtk` 等系统库；
> 应用以本地服务运行，通过浏览器访问。

---

## 4. 网络访问与安全

默认服务只监听 `127.0.0.1:12345`，且没有用户认证。只有在可信网络中才使用：

```bash
python backend/main.py --no-ui --host 0.0.0.0 --port 12345
```

`--host 0.0.0.0` 会暴露服务及其可读取的文件，请勿直接暴露到公网。

## 5. 插件扩展 (Plugins)

LogLayer 源码模式从配置的插件目录加载插件；Frozen 模式从可执行文件同级的
`plugins/` 目录加载插件，不依赖当前工作目录或 PyInstaller 内部路径。
- 源码模式：新插件使用 `loglayer.plugin.json` manifest 和标准 entry point，示例见 `examples/plugins/demo-plugin/`。
- Frozen 模式：将受信任插件放入 `LogLayer_Standalone/plugins/`，无需重新打包。

## 6. 常见问题 (FAQ)

- **搜索或过滤失效**：检查 `app/bin/<platform>/` 目录下是否包含对应平台的 `rg`（ripgrep）二进制文件，或确认系统 `PATH` 中存在 `rg`。
- **界面无法打开**：确认后端已启动，并访问 `http://127.0.0.1:12345`；同时检查端口是否被占用。
- **依赖冲突**：建议在虚拟环境 (venv) 中进行打包操作。
- **非 UTF-8 日志显示异常**：当前读取与搜索链路按 UTF-8 解码，非 UTF-8 文件可能出现替换字符。
