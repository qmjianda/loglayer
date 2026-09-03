# LogLayer

[English](#english) | [中文](#chinese)

---

<a name="english"></a>
## English

LogLayer is a high-performance log analysis tool designed to handle massive log files (1GB+) with ease. It combines the raw power of Python's system-level operations with a modern React frontend via a browser-compatible FastAPI backend, providing a desktop-class experience for developers and SREs.

### 🚀 Key Features
- **Lightning-Fast Indexing**: Leverages `mmap` and multi-threaded indexing to parse 1GB+ logs in seconds.
- **DOM Virtual Scrolling**: `react-virtuoso` virtualization with preloading and memoized rows keeps the UI smooth even when viewing millions of lines.
- **Native Search (ripgrep)**: Integrated with `ripgrep` for blazing-fast, case-insensitive searching across massive datasets.
- **Layered Pipeline Engine**: A Python-powered backend pipeline that supports multiple FILTER and HIGHLIGHT layers applied in real-time.
- **Workspace Session Persistence**: Automatically saves and restores your opened files and layer configurations into a `.loglayer/` folder.
- **One-Click Offline Packaging**: Build a standalone, portable distribution for Windows and Linux with a single command.
- **Lightweight Architecture**: **FastAPI** local service + browser access — no system GUI libraries required.

### 🛠 Tech Stack
- **Backend**: Python 3.10+, **FastAPI**, **uvicorn**, **WebSockets**, `mmap`, `ripgrep`.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4.

### 🚦 Quick Start

#### 1. Prerequisites
- **Node.js**: v18+
- **Python**: v3.10+

#### 2. Installation
```bash
# Clone the repository
git clone https://github.com/qmjianda/loglayout.git
cd loglayer

# Install frontend dependencies
npm install

# Install backend dependencies
pip install -r requirements.txt
```

#### 3. Running the App
**Development Mode**: Open two terminal windows.
1. `npm run dev` — dev frontend at http://localhost:3000
2. `python backend/main.py` — backend service at http://127.0.0.1:12345

**Standalone Packaging**:
- **Source-based Bundle**: Run `python tools/package_offline.py`. Requires Python on the user's machine. Start with `python app/main.py` from `dist_offline/`.
- **Standalone EXE (Frozen)**: Run `python tools/package_offline.py --exe`. Requires `pip install pyinstaller`. No Python required on the target machine — double-click `LogLayer_Standalone/LogLayer.exe` (Windows) or `LogLayer_Standalone/LogLayer` (Linux).
The build will be generated in `dist_offline/`. The bundle includes ripgrep for both Windows and Linux, so a single package works on either platform.

---

<a name="chinese"></a>
## 中文

LogLayer 是一款专门针对海量日志文件（1GB+）设计的高性能日志分析工具。它通过兼容浏览器的 FastAPI 后端桥接了 Python 原生系统级的处理能力与现代化的 React 前端，为开发者和运维工程师提供原生级别的桌面分析体验。

### 🚀 核心特性
- **极速索引**: 利用 `mmap` 和多线程偏移量索引技术，数秒内即可载入 GB 级日志。
- **DOM 虚拟滚动**: 基于 `react-virtuoso` 的虚拟化渲染，配合预加载与 memo 行优化，处理数百万行日志时界面依然流畅。
- **原生搜索 (ripgrep)**: 集成 `ripgrep`，在大规模数据集中提供瞬间响应的全文检索。
- **图层流水线引擎**: 基于 Python 后端的处理流水线，支持多路“过滤器（FILTER）”和“高亮（HIGHLIGHT）”图层叠加。
- **工作区会话持久化**: 自动保存并恢复已打开的文件列表和图层配置（存储于 `.loglayer/` 目录）。
- **一键离线发布**: 提供一键打包脚本，生成支持 Windows 和 Linux 的自包含绿色版离线应用。
- **轻量化架构**: 采用 **FastAPI** 本地服务 + 浏览器访问，无需安装任何系统级 GUI 依赖。

### 🛠 技术栈
- **后端**: Python 3.10+, **FastAPI**, **uvicorn**, **WebSockets**, `mmap`, `ripgrep`.
- **前端**: React 19, TypeScript, Vite, Tailwind CSS 4.

### 🚦 快速开始

#### 1. 前置要求
- **Node.js**: v18+
- **Python**: v3.10+

#### 2. 安装
```bash
# 克隆仓库
git clone https://github.com/qmjianda/loglayout.git
cd loglayer

# 安装前端依赖
npm install

# 安装后端依赖
pip install -r requirements.txt
```

#### 3. 运行应用
**开发模式**: 需要开启两个终端。
1. `npm run dev` — 开发前端 http://localhost:3000
2. `python backend/main.py` — 后端服务 http://127.0.0.1:12345

**离线打包**:
- **源码包**: 运行 `python tools/package_offline.py`。需要目标机器安装有 Python。启动方式：在 `dist_offline/` 下执行 `python app/main.py`。
- **独立可执行程序 (Frozen)**: 运行 `python tools/package_offline.py --exe`。需要先安装 `pip install pyinstaller`。生成的程序无需 Python 即可运行，双击 `LogLayer_Standalone/LogLayer.exe`（Windows）或运行 `LogLayer_Standalone/LogLayer`（Linux）启动。
打包结果将生成在 `dist_offline/` 目录下。发布包同时包含 Windows 与 Linux 的 ripgrep 二进制，单包可跨平台使用。
