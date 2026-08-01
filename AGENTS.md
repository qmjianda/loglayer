# AGENTS.md - LogLayer Agent Guidelines

高性能日志分析桌面应用（React 前端 + Python/FastAPI 后端，pywebview 桌面壳）。代码注释与文档多为中文。

## 项目概况

| 维度 | 描述 |
|:-----|:-----|
| **产品形态** | 桌面应用（pywebview + FastAPI） |
| **目标用户** | 开发工程师、运维人员、SRE |
| **核心场景** | 大型日志文件分析、错误追踪、性能优化 |
| **竞争优势** | mmap 索引、Canvas 虚拟滚动、多引擎搜索 |

- **后端**：Python 3.10+ | FastAPI | mmap | ripgrep | pywebview
- **前端**：React 19 | TypeScript | Vite | Tailwind CSS 4 | HTML5 Canvas
- **测试**：pytest | Playwright(e2e) | npm

## 新会话启动

```
1. 阅读本文件（AGENTS.md）          → 概况、规则、架构地图、导航
2. 运行 openspec-cn list --json    → 当前活跃变更与进度
3. 按任务类型进入对应深潜文档或代码（见下"导航"）
```

## 开发命令

```bash
npm run dev                 # 前端 Vite (port 3000)，代理 /api 与 /ws 到 127.0.0.1:12345
python backend/main.py      # 后端 FastAPI + pywebview 桌面窗口 (port 12345)
python backend/main.py --no-ui   # 仅启动后端服务（e2e 测试用）
```

- 前后端是两个独立进程，需各开一个终端。后端端口 `--port`（默认 12345），`--host 0.0.0.0` 可外部访问。
- 生产模式后端从 `backend/www/` 挂载前端静态文件（`app.mount("/", StaticFiles(...))`，backend/main.py:436）。

## 测试

```bash
python3 -m pytest                # 单测 + 集成（默认排除 e2e）
python3 -m pytest tests/unit/    # 单元测试
python3 -m pytest tests/e2e -v   # e2e：需已起 backend(12345)+vite(3000)+Playwright chromium
```

- **e2e 默认被排除**：`tests/conftest.py` 用 `collect_ignore` 忽略，需显式指定目录。
- e2e 前置：`pip install playwright && python -m playwright install chromium`；大日志 `tests/logs/large_test.log`（1.3GB，gitignored）不存在时测试被 skip，用 `python tests/benchmarks/gen_big_file.py` 生成。
- 测试直接 `import bridge` / `from loglayer import ...`，通过 `sys.path` 注入 `backend/`（tests/conftest.py、部分单测自行 insert）。
- **搜索/测试依赖自带 ripgrep 二进制**（`bin/<platform>/rg`，conftest `rg_path` fixture），勿依赖系统 `rg`，勿删除 `bin/` 目录。

## 构建 / 类型检查

```bash
npm run build        # tsc && vite build（无独立 lint；typecheck 即 tsc）
npx tsc --noEmit     # 仅类型检查
```

- tsconfig 的 `exclude` 包含 `**/*.spec.ts`、`**/*.test.ts`，测试文件不做类型检查。
- 前端别名 `@/*` → `frontend/src/*`（tsconfig 与 vite 同时配置）。
- 打包：`python tools/package_offline.py`（源码包）/ `--exe`（PyInstaller 独立可执行），输出 `dist_offline/`。

## 架构地图（粗略快照，细节以代码为准）

```
              ┌────────────────── 桌面壳 pywebview ──────────────────┐
              │                                                      │
  backend      │            frontend                                 │
┌──────────────▼──┐        ┌───────────────▼───────────────────────┐  │
│ bridge.py       │  REST   │ bridge_client.ts (API/WS 客户端)      │  │
│ mmap 索引        │────────▶│ App.tsx ── hooks/ ── components/      │  │
│ FileBridge/      │  ◀─────│   └─ LogViewer.tsx (Canvas 虚拟滚动)  │  │
│ LogSession       │   WS   │   └─ SearchPanel / LayersPanel 等      │  │
└────────┬─────────┘        └──────────────────────────────────────┘  │
         │                                                            │
         ▼                                                            │
┌────────────────────┐                                               │
│ loglayer/ 图层引擎  │  sync_layers() 数据 / sync_decorations() 视觉  │
│ core → registry →  │                                               │
│ builtin/ 内置图层   │                                               │
├────────────────────┤                                               │
│ ai/  AI 分析        │  providers/ (heuristic/cloud/local)           │
│ plugins/ 插件       │                                               │
└────────────────────┘                                               │
```

- **后端核心**：`backend/bridge.py`（mmap 索引、文件操作、信号）、`backend/main.py`（REST/WS 端点，`include_router(ai_router)`）、`backend/loglayer/`（`core.py` 基类、`registry.py` 注册表、`builtin/` 内置图层）、`backend/ai/`（AI 分析，多 provider）、`backend/plugins/`。
- **前端核心**：`frontend/src/App.tsx`、`bridge_client.ts`、`components/LogViewer.tsx`（Canvas 虚拟滚动，性能关键）、`hooks/`、`contexts/`。
- **图层系统**：数据层 `sync_layers()` vs 视觉层 `sync_decorations()`，新增图层照 `LAYER_DEV_GUIDE.md` 实现并注册到 `registry.py`。
- **会话持久化**：`.loglayer/`（gitignored）存工作区配置。
- **AI**：`GEMINI_API_KEY` 经根目录 `.env` 由 vite `loadEnv` 注入前端（vite.config.ts:26）；后端 AI 配置走 `/api/ai/config`。当前仓库无 `.env`。
- **端口固定**：后端 12345、vite 3000，e2e 会复用已在跑的实例。

## 关键接口

### REST API（backend/main.py 与 ai/endpoints.py）
```
POST /api/open_file              # 打开文件
POST /api/close_file             # 关闭文件
POST /api/sync_all               # 全量同步
POST /api/sync_layers            # 数据层图层
POST /api/sync_decorations       # 视觉层图层
GET  /api/read_processed_lines   # 读取处理后的行范围
POST /api/search_ripgrep         # ripgrep 搜索
POST /api/toggle_bookmark        # 书签开关
GET  /api/log_level_stats        # 级别统计
POST /api/export_logs            # 导出日志
GET  /api/platform               # 平台信息
GET  /api/get_layer_registry     # 图层注册表
...（完整清单见 backend/main.py 的 @app 装饰器）
```

### AI 接口（前缀 /api/ai）
```
POST /api/ai/chat                 # AI 对话
POST /api/ai/detect-timestamp     # 时间戳检测
POST /api/ai/suggest-time-range   # 时间范围建议
GET  /api/ai/models               # 可用模型
GET/POST /api/ai/config           # AI 配置读写
POST /api/ai/test-connection      # 连接测试
```

### WebSocket 信号（/ws）
```
fileLoaded          # 文件加载完成 (file_id, uri)
pipelineFinished    # 图层处理完成 (file_id, indices_len, matches_len)
statsFinished       # 统计完成 (file_id, stats)
operationProgress   # 操作进度 (file_id, op, progress)
```

## 已知限制

| 限制 | 描述 | 规避方案 |
|:-----|:-----|:---------|
| 大文件滚动 | 1000万行以上需要滚动缩放 | 使用 `useScrollScaling` |
| 内存占用 | 完整加载所有行 | 虚拟滚动 + 按需加载 |
| 搜索精度 | ripgrep 正则 | 纯 Python 正则备选 |

## OpenSpec 开发流程（本项目固定工作流）

- 开发以 OpenSpec 变更驱动：`openspec/` 下 `changes/<name>/`（proposal/design/specs/tasks）与 `specs/`。
- 使用 `openspec-cn` CLI + `.opencode/commands/opsx-*.md` 命令 / `.opencode/skills/openspec-*` 技能。典型链路：`/opsx-new` → `/opsx-continue`（产出物）→ `/opsx-apply`（实现，逐个勾选 tasks）→ `/opsx-verify` → `/opsx-archive`。
- 变更名 kebab-case；用 `openspec-cn status --change <name> --json` 与 `openspec-cn instructions apply --change <name> --json` 获取产出物路径与指令，勿假设文件位置。
- 实现中每完成一个 task 立即更新其 checkbox；任务模糊或遇到阻塞时暂停询问，不要猜。

## 代码规范

- **Python**：4 空格缩进、snake_case、函数签名带类型标注；REST 用 Pydantic `BaseModel`；异常打 `print(f"[Module] Error: {e}")`。
- **TypeScript**：2 空格、单引号、camelCase；函数式组件 + hooks；避免 `any`（用 `unknown`）；全局状态用 React Context。
- **性能红线**：所有日志渲染必须虚拟化（O(1)）；修改 mmap 索引/渲染路径时注意 CPU/内存影响。
- **UI/UX**：不用 emoji 图标（用 SVG/Lucide）；可点击元素加 `cursor-pointer`；明暗主题均需有对比度。

## Git 约定

- 提交风格：`Feat:` / `Fix:` / `Perf:` / `Refactor:` / `Revert:` 前缀 + 简短描述（多数中文）。主分支 `main`，另有 `dev`。
- Bug 修复应带最小复现（`tests/repro/` 或单测），"无测试不闭环"。

## 导航

- **开发状态 / 进度**：`openspec-cn list --json`（实时查询，无手写进度文档）。
- **变更与决策**：`openspec/`（specs/ 能力规范、changes/ 活跃变更、archive/ 历史归档）。
- **图层/插件开发**：`docs/LAYER_DEV_GUIDE.md`（新增图层时必读）。
- **索引优化**：`docs/INDEXING_OPTIMIZATION.md`（索引性能相关）。
- **历史 ADR**：`docs/TECHNICAL_DECISIONS.md`（冻结，只读）。
- **会话模板**：`.opencode/commands/session-template.md`。
- 代码查询优先使用 codegraph（`codegraph_explore` MCP / `codegraph explore` CLI）以减少文件读取；本仓库暂无 `.codegraph/` 索引，可运行 `codegraph init` 启用。
