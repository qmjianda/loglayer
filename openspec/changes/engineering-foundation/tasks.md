# Tasks: engineering-foundation

## 1. CI 配置

- [x] 1.1 创建 `.github/workflows/ci.yml`：backend job（setup-python 3.10 + pip install + pytest unit/integration）
- [x] 1.2 在 ci.yml 中新增 frontend job（setup-node + npm ci + tsc && vitest run && vite build）
- [x] 1.3 ci.yml 配置推送 main/dev 与 PR 双触发
- [x] 1.4 验证 CI 内生成大文件降级样本（gen_big_file.py，50MB 样本）而非依赖 1.3GB 本地文件
- [x] 1.5 确认 CI 中 ripgrep 复用 `bin/<platform>/rg`（bin/ 已 git 跟踪，conftest rg_path fixture 生效）

## 2. lint / format 门槛

- [x] 2.1 初始化前端 ESLint 配置（eslint.config.js flat config + @eslint/js + typescript-eslint + react-hooks）
- [x] 2.2 添加 Prettier 配置（.prettierrc.json + .prettierignore）
- [x] 2.3 package.json 添加 scripts：`lint`（eslint --quiet，error=0 门槛）、`format`、`format:check`
- [x] 2.4 添加后端 ruff 配置（ruff.toml，保守 E4/E7/E9/F 规则集，ignore 存量已知问题 E402/E701/E722/E741/F401/F541/F841）
- [x] 2.5 本地跑通 `npm run lint`（0 error）、`npm run format:check`（已全量格式化 87 文件）、`ruff check backend tests`（全过）
- [x] 2.6 将 lint/format 步骤纳入 CI（backend job 含 ruff，frontend job 含 eslint + prettier）

## 3. 版本基线

- [x] 3.1 package.json version 0.0.0 → 0.1.0，补充 `engines.node >= 18`
- [x] 3.2 后端新增 `backend/__init__.py` 与 `__version__ = "0.1.0"` 常量
- [x] 3.3 AGENTS.md 中提示版本同步点（前端 package.json 与后端常量手工同步）

## 4. README 名实修正

- [x] 4.1 README 英文版 "O(1) Virtual Scrolling" 改为 DOM Virtual Scrolling（react-virtuoso）+ preloading + memoized rows
- [x] 4.2 README 中文版 "O(1) 虚拟化渲染" 同步修正为 DOM 虚拟滚动
- [x] 4.3 AGENTS.md 架构地图中 "Canvas 虚拟滚动" / "HTML5 Canvas" 字样纠正为 DOM 虚拟滚动 / react-virtuoso
- [x] 4.4 docs/TECHNICAL_DECISIONS.md TD-001 添加名实更正声明（不改写 ADR 正文）

## 5. CHANGELOG 机制

- [x] 5.1 引入 git-cliff（npm devDependency）
- [x] 5.2 添加 cliff.toml 配置（Conventional Commits 解析 Feat:/Fix:/Perf: 大小写前缀 + 中文回退分组）
- [x] 5.3 添加 `npm run changelog` / `changelog:unreleased` 脚本并生成首个 CHANGELOG.md（118 行，7 分组）
- [x] 5.4 AGENTS.md 补充 CHANGELOG 生成命令说明

## 6. 验证收尾

- [x] 6.1 本地全量验证：lint（0 error）+ format:check（全过）+ pytest（83 passed）+ tsc + vitest（47 passed）+ build 全绿
- [ ] 6.2 推送 main 触发 CI，确认 backend/frontend job 绿灯（需用户推送，见会话收尾说明）
- [x] 6.3 更新 openspec/specs/project-docs/spec.md 与 ci-pipeline/code-quality-gates 规范同步（归档时由 openspec archive 处理）
