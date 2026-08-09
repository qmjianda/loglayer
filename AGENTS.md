# AGENTS.md - LogLayer Agent Guidelines

高性能日志分析桌面应用（React 前端 + Python/FastAPI 后端，pywebview 桌面壳）。代码注释与文档多为中文。

## 项目概况

| 维度 | 描述 |
|:-----|:-----|
| **产品形态** | 桌面应用（pywebview + FastAPI） |
| **目标用户** | 开发工程师、运维人员、SRE |
| **核心场景** | 大型日志文件分析、错误追踪、性能优化 |
| **竞争优势** | mmap 索引、DOM 虚拟滚动、多引擎搜索 |

- **后端**：Python 3.10+ | FastAPI | mmap | ripgrep | pywebview
- **前端**：React 19 | TypeScript | Vite | Tailwind CSS 4 | react-virtuoso
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
python backend/main.py --no-ui   # 启动后端服务，不带pywebview，而是通过网页访问（当前主要使用方式可用于e2e 测试，调试，验证效果等）
```

- 前后端是两个独立进程，需各开一个终端。后端端口 `--port`（默认 12345），`--host 0.0.0.0` 可外部访问。
- 生产模式后端从 `backend/www/` 挂载前端静态文件（`app.mount("/", StaticFiles(...))`，backend/main.py:491）。

## 测试

```bash
python3 -m pytest                # 单测 + 集成（默认排除 e2e）
python3 -m pytest tests/unit/    # 单元测试
npm run e2e                      # 推荐：e2e 一键编排（默认 light：21 个，不含 1.3GB 大文件）
npm run e2e -- --heavy           # 大文件专项（4 个，需 large_test.log，峰值内存高）
npm run e2e -- --setup           # 首次初始化：装 playwright/浏览器/npm 依赖、生成大日志
npm run e2e -- --reuse           # 复用已在跑的 backend(12345)+vite(3000)，跳过杀进程/重启
npm run e2e:env                  # 仅环境自检（依赖/内存/端口）
```

- **e2e 默认被排除**：`tests/conftest.py` 用 `collect_ignore` 忽略，需显式指定目录。
- **服务生命周期**：conftest 默认**强制杀掉**占用 12345/3000 的既有进程再启动（保证测最新代码）；设 `LOGLAYER_E2E_REUSE=1` 或 `--reuse` 才复用已在跑的实例（快，但需自行保证服务代码为最新）。**不会**自动复用已在跑的实例。
- e2e 前置：`pip install playwright && python -m playwright install chromium`；大日志 `tests/logs/large_test.log`（1.3GB，gitignored）不存在时 heavy 测试被 skip，用 `python tests/benchmarks/gen_big_file.py` 生成。
- **大文件测试（heavy）内存要求高**：backend 索引 1.3GB 峰值 2.4GB+ 内存，WSL2 内存 <8GB 时可能被 OOM 杀死（表现为页面 crash / 连接被拒）。建议 `~/.wslconfig` 配 `memory=12GB`；`npm run e2e:env` 会检测并提示。
- 测试直接 `import bridge` / `from loglayer import ...`，通过 `sys.path` 注入 `backend/`（tests/conftest.py、部分单测自行 insert）。
- **搜索/测试依赖自带 ripgrep 二进制**（`bin/<platform>/rg`，conftest `rg_path` fixture），勿依赖系统 `rg`，勿删除 `bin/` 目录。

## 构建 / 类型检查 / 质量门槛

```bash
npm run build        # tsc && vite build
npx tsc --noEmit     # 仅类型检查
npm run lint         # ESLint（前端，error=0 门槛）
npm run format       # Prettier 自动格式化（前端）
npm run format:check # Prettier 检查（前端）
ruff check backend tests   # ruff 检查（后端，error=0 门槛）
```

- tsconfig 的 `exclude` 包含 `**/*.spec.ts`、`**/*.test.ts`，测试文件不做类型检查。
- 前端别名 `@/*` → `frontend/src/*`（tsconfig 与 vite 同时配置）。
- **lint 门槛策略**：error 级必须为 0；存量 warning/ignore 规则按模块渐进收敛，新改动不得引入 error。
- **CI**：`.github/workflows/ci.yml` 在推送 main/dev 与 PR 时运行后端 pytest + ruff、前端 tsc + eslint + prettier + vitest + build。本地全绿后再推送。
- **版本同步**：`package.json` version 与 `backend/__init__.py` 的 `__version__` 手工同步（当前 0.1.0）；改动版本时两处一起改。
- **CHANGELOG**：`npm run changelog`（git-cliff 全量）/ `npm run changelog:unreleased`（仅未发布改动）；发布打 tag 后重新生成。
- 打包：`python tools/package_offline.py`（源码包）/ `--exe`（PyInstaller 独立可执行），输出 `dist_offline/`。

## 架构地图（粗略快照，细节以代码为准）

```
              ┌────────────────── 桌面壳 pywebview ──────────────────┐
              │                                                      │
  backend      │            frontend                                 │
┌──────────────▼──┐        ┌───────────────▼───────────────────────┐  │
│ bridge.py       │  REST   │ bridge_client.ts (API/WS 客户端)      │  │
│ mmap 索引        │────────▶│ App.tsx ── hooks/ ── components/      │  │
│ FileBridge/      │  ◀─────│   └─ LogViewer.tsx (DOM 虚拟滚动)     │  │
│ LogSession       │   WS   │   └─ SearchPanel / LayersPanel 等      │  │
│ cache_store 缓存  │        │   └─ rendering/ 前端渲染器注册表      │  │
└────────┬─────────┘        │   └─ store/ searchStore (per-tab)      │  │
         │                  └────────────────────────────────────────┘  │
         ▼                                                            │
┌────────────────────┐                                               │
│ loglayer/ 图层引擎  │  数据层 sync_layers()（FILTER/TRANSFORM 后端）  │
│ core → registry →  │  视觉层由前端渲染器接管（HIGHLIGHT/ROWTINT/    │
│ builtin/ 内置图层   │  LEVEL 在前端计算 segments/rowStyle）           │
├────────────────────┤                                               │
│ ai/  AI 分析        │  providers/ (heuristic/cloud/local)           │
│ plugins/ 插件       │                                               │
└────────────────────┘                                               │
```

- **后端核心**：`backend/bridge.py`（mmap 索引、文件操作、信号、PipelineWorker 阶段计时）、`backend/main.py`（REST/WS 端点，含 `/api/diagnostics` 可观测接口）、`backend/loglayer/`（`core.py` 基类、`registry.py` 注册表、`builtin/` 内置图层、`cache_store.py` 统一缓存层、`cache_keys.py` 缓存 key）、`backend/ai/`、`backend/plugins/`。
- **前端核心**：`frontend/src/App.tsx`、`bridge_client.ts`、`components/LogViewer.tsx`（DOM 虚拟滚动，性能关键）、`rendering/`（渲染器注册表 `registry.ts` + 规则引擎 `ruleEngine.ts`，前端计算图层高亮/行样式）、`store/searchStore.ts`（zustand per-tab 搜索状态：词/配置/rank 按 panelId 独立）、`hooks/`。
- **图层系统（重构后）**：数据层（FILTER/TRANSFORM）仍在后端 `sync_layers()` 管线；**渲染层（HIGHLIGHT/ROWTINT/LEVEL）执行移到前端**——后端只下发图层配置，前端渲染器按配置计算 segments/rowStyle（`renderWithIsolation` 错误隔离，坏渲染器仅失效该层不白屏）。新增渲染层照 `LAYER_DEV_GUIDE.md` 实现渲染器并注册 `frontend/src/rendering/registry.ts`；后端 registry 保留元数据（type/ui_schema/engine）供配置表单。
- **per-tab 搜索**：搜索词/配置/rank 存 `searchStore`（key=panelId），切 tab 自动恢复；后端 `LogSession` 保持 per-file 权威，搜索缓存命中跳过 rg 扫描（`cache_store.py`）。
- **搜索高亮**：前端对可见行按 per-tab 词即时计算（memoize by content+query），后端不再逐行下发高亮。
- **书签**：数据在后端（KV 持久化行号列表），视觉在前端（`bookmarks` 数据驱动 ★/● 标记与行背景）。
- **可观测**：`/api/diagnostics` 返回缓存 hit/miss 统计 + 各文件管线阶段耗时；前端 Ctrl+Shift+D 打开 Debug overlay。
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

## 开发主流程（Specification-Driven + ATDD，本项目固定工作流）

```
需求 → OpenSpec(规格对齐) → ATDD(验收测试) → Oh-My-OpenCode(多Agent实现) → OpenCode(执行) → 验证
  ↑____________________________________反馈循环______________________________________↓
```

- 本仓库强制"先写规格再写代码、先写验收测试再实现"：任何功能/修复都从 OpenSpec 变更开始，禁止未经变更直接写实现。
- 每步产出与上一步对齐，验证不通过则回到对应阶段（反馈循环），不跳过 ATDD 直接实现。

### OpenSpec 变更

- 开发以 OpenSpec 变更驱动：`openspec/` 下 `changes/<name>/`（proposal/design/specs/tasks）与 `specs/`（归档后的能力规范）。
- 使用 `openspec-cn` CLI + `.opencode/commands/opsx-*.md` 命令 / `.opencode/skills/openspec-*` 技能。典型链路：`/opsx-new` → `/opsx-continue`（产出物）→ `/opsx-apply`（实现）→ `/opsx-verify` → `/opsx-archive`。
- 变更名 kebab-case；用 `openspec-cn status --change <name> --json` 与 `openspec-cn instructions apply --change <name> --json` 获取产出物路径与指令，勿假设文件位置。
- 实现中每完成一个 task 立即更新其 checkbox；任务模糊或遇到阻塞时暂停询问，不要猜。

### ATDD 验收循环（specs 产出后、实现前必须走完）

```
spec 的 AC 验收条件(WHEN-THEN Scenarios) → 编写验收测试 → 运行(红) → AI 实现代码 → 运行(绿) → 重构
```

- **验收条件来源**：`changes/<name>/specs/<capability>/spec.md` 中每个 Requirement 的 `WHEN…/THEN…/AND…` Scenario 即 AC，逐条落到测试断言，验收测试必须能追溯到 AC。
- **先红后绿**：先写验收测试并运行确认失败（红），再写实现让其通过（绿），最后重构；不得先实现后补测试。
- **验收测试归属**：纯后端/算法逻辑放 `tests/unit/`（如 `test_<capability>.py`）；跨前后端/UI 交互放 `tests/e2e/`（需起前后端，见上"测试"）；Bug 修复的最小复现放 `tests/repro/`。多 Agent 实现时（Oh-My-OpenCode）每个子 Agent 以各自的验收测试为完成标准。
- 未过验收测试的实现不算完成；`/opsx-verify` 前先确认全部验收测试为绿。

## 代码规范

- **Python**：4 空格缩进、snake_case、函数签名带类型标注；REST 用 Pydantic `BaseModel`；异常打 `print(f"[Module] Error: {e}")`。
- **TypeScript**：2 空格、单引号、camelCase；函数式组件 + hooks；避免 `any`（用 `unknown`）；全局状态用 React Context。
- **性能红线**：所有日志渲染必须虚拟化（O(1)）；修改 mmap 索引/渲染路径时注意 CPU/内存影响。
- **UI/UX**：不用 emoji 图标（用 SVG/Lucide）；可点击元素加 `cursor-pointer`；明暗主题均需有对比度。

## Debug 日志规范（健全 + 方便开关）

调试输出要有**统一架构**和**统一开关**，默认关闭、按需开启；主要用于排查问题，不是常驻日志。

- **统一前缀格式**：所有调试输出带 `[Module]` 前缀。后端 `print(f"[Pipeline] ...")`，前端 `console.log('[Search] ...')`——禁止裸输出、禁止事后遗留调试代码。
- **统一开关，勿硬编码**：
  - 后端：读环境变量（沿用现有 `LOGLAYER_ENV` / 新增如 `LOGLAYER_DEBUG=1`），初始化时算一次开关，模块内用条件判断或按需注入，不在每个调用点拼条件。
  - 前端：走构建期开关（vite `define` / `import.meta.env`，如 `VITE_DEBUG`），封装成一个小 logger 工具，不在组件里散写 `console.log`。
- **性能红线**：热路径（渲染循环、mmap 索引、搜索匹配、图层处理）禁止无开关的日志输出；Debug 日志关闭时不得有可测开销（O(1) 判断，不做字符串拼接/格式化）。
- **日志内容有诊断价值**：包含定位所需上下文（file_id、索引/行号、耗时 ms、缓存命中与否），能回答"为什么"而不只是"发生了什么"。
- 已有代码如散落 `console.log`，新增改动时顺手收敛到统一 logger；提交前清除临时调试输出。

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


## 规则
如果自行测试、验证、分析有问题，告诉用户手动测试，并给出测试方法。如果自测卡住需要解决很多疑难问题，如实告诉用户，由用户帮忙解决。