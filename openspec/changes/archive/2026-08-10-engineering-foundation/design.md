## Context

LogLayer 是单用户维护的个人工具（Q1=A），但已具备 6,300+ 行后端与 15,000+ 行前端的规模，且有 65 个后端单测 + 6 个 e2e 可复用。当前缺失工程地基：无 CI、无 lint、无版本基线，README 声称 Canvas 渲染与实际 DOM 虚拟滚动不符。本变更一次性补齐这些"一次投入、长期受益"的设施，不涉及业务逻辑改动。

约束：
- 个人项目，CI 成本需控制在 GitHub Actions 免费额度内（精简步骤、缓存依赖）。
- 大文件测试数据（1.3GB）gitignored，CI 需降级样本。
- 搜索测试依赖 `bin/<platform>/rg`，需在 CI 复用注入策略（conftest `rg_path` fixture 已支持）。
- 存量代码存在 warning 级问题，门槛定为 "error=0" 而非一次性全量整改。

## Goals / Non-Goals

**Goals:**
- 建立 CI 自动验证（后端 pytest + 前端 tsc/vitest/build），推送与 PR 双触发。
- 引入前端 ESLint/Prettier 与后端 ruff 的 "error=0" 门槛，纳入 CI 与本地脚本。
- 版本号 0.0.0 → 0.1.0 基线，补 `engines` 约束。
- 修正 README 中 Canvas 虚拟滚动的名实不符表述，改为 DOM 虚拟滚动。
- 基于 Conventional Commits 生成 CHANGELOG（个人用简化版）。

**Non-Goals:**
- 不引入 release-please / semantic-release 全流程（Q1=A，个人工具，后续再说）。
- 不一次性整改全部存量 lint warning。
- 不修改任何业务代码逻辑。
- 不在本次引入 e2e 到 CI（e2e 需起前后端 + Playwright，成本高，留给后续发布阶段决策）。

## Decisions

### D1: CI 采用 GitHub Actions 单工作流

**决策**：`.github/workflows/ci.yml` 单一工作流，两个 job（backend / frontend），推送 main 与 PR 双触发。

**备选考虑**：
- *GitLab CI / 自建 runner*：个人项目无此基础设施，排除。
- *多工作流拆分*：当前规模无需，单工作流内分 job 即可并行。

**理由**：GitHub Actions 免费额度对个人项目足够；单工作流降低维护面；job 级并行满足后端/前端独立验证。

### D2: lint 门槛为 "error=0"（max-warnings 0）

**决策**：前端 `eslint --max-warnings 0` + `prettier --check`；后端 `ruff check`（error 级）。存量 warning 不阻塞，但新代码不得引入 error。

**备选考虑**：
- *warning 也归零*：存量代码 warning 多，一次性整改成本高且与"纯结构变更"目标冲突，排除。
- *只加配置不入门槛*：无约束力，失去意义，排除。

**理由**：error=0 是"可执行的最小约束"——既拦住明显问题，又不逼迫大整改；warning 收敛留给日常改动自然消化。

### D3: 后端版本常量与前端同步

**决策**：前端 `package.json` version → 0.1.0 + `engines.node >= 18`；后端在 `backend/__init__.py`（或 `main.py`）定义 `__version__ = "0.1.0"` 常量，两者手工保持同步（个人项目不引入双源构建）。

**备选考虑**：
- *单一版本源 + 构建时注入*：对个人项目过度设计，排除。

**理由**：一次同步成本极低；后续若走向发布（Q1=B/C）再升级为单一版本源。

### D4: CHANGELOG 用 git-cliff（或等价轻量工具）

**决策**：引入 `git-cliff`（Rust 二进制，轻量）基于 Conventional Commits 生成 CHANGELOG.md，`npm run changelog` 或 make 脚本包装。

**备选考虑**：
- *changesets*：面向多包发布，个人项目过重，排除。
- *手写 CHANGELOG*：易遗漏、与提交脱节，排除。

**理由**：git-cliff 单二进制、零依赖、支持自定义模板；提交前缀（Feat:/Fix:/Perf:）已具备基础，只需规范化为 Conventional Commits 格式。

### D5: README 名实修正为 DOM 虚拟滚动

**决策**：README 中 "O(1) Virtual Scrolling"（中英两版）改为 "DOM 虚拟滚动（react-virtuoso）+ 预加载 + memo 优化"；AGENTS.md 架构地图同步纠正"Canvas 虚拟滚动"字样；冻结 ADR 在 `TECHNICAL_DECISIONS.md` 中加一行名实更正声明，不改写 ADR 正文（遵守 project-docs spec）。

**理由**：名实不一会误导 AI 与用户走错误的技术方向（如试图重写 Canvas 渲染）；修正成本极低、收益是认知一致性。

## Risks / Trade-offs

- **[CI 环境差异（Python 版本/依赖）] → Mitigation**：CI 用 `actions/setup-python` 固定 3.10+，`pip install -r requirements.txt`，缓存 pip；前端 `npm ci` + `actions/setup-node` 缓存。
- **[CI 首次跑通成本] → Mitigation**：先以"最小绿灯"目标落地（pytest + tsc + build），lint 作为独立 job 逐步加严，避免一次性全红卡住主流程。
- **[git-cliff 引入新工具链] → Mitigation**：仅作为 devDependency/CI 可选步骤，不进入运行时；生成失败不影响主流程。
- **[ruff 对存量代码报大量 error] → Mitigation**：首版配置用 `lint.select` 保守集（E/F 基本规则），`ignore` 存量已知问题，迭代放宽。
- **[版本号手工同步漂移] → Mitigation**：当前仅一处后端常量 + package.json，改动时在 AGENTS.md 提示；如频繁漂移再升级单一版本源。

## Migration Plan

1. 新增配置文件（workflow / eslint / prettier / ruff / git-cliff）与脚本。
2. 版本号更新（package.json + 后端常量）。
3. README / AGENTS.md / ADR 名实修正。
4. 本地跑通全部门槛命令（lint/format/test/build）。
5. 推送验证 CI 绿灯；红灯则按 job 逐一修复。
6. 回滚策略：纯新增/文档变更，无行为回归；CI 配置失败仅影响 CI 不伤运行时。

## Open Questions

- CHANGELOG 是否纳入 CI 产物（每次发布打 tag 生成）还是仅本地命令？倾向后者（个人项目）。待实现时确认。
- ruff 首版规则集选保守集（E/F）还是更广（含 UP/简化规则）？倾向保守集起步。
