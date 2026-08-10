## Why

LogLayer 已具备 6,300+ 行后端、15,000+ 行前端与 65 个单测的规模，但工程地基缺失：无 CI（质量全靠人肉运行）、无 lint/格式化门槛、版本号停留在 0.0.0、README 声称的 "O(1) Virtual Scrolling" 与实际的 DOM 虚拟滚动（react-virtuoso）不符。这些短板在每次改动时都会消耗信任成本，且阻碍后续发布与协作。

## What Changes

- **新增 CI（GitHub Actions）**：后端 `pytest`（unit + integration，e2e 按需标记）+ 前端 `tsc && vitest && vite build`。大文件测试用 `tools/benchmarks/gen_big_file.py` 生成降级样本（如 100MB），不依赖 gitignored 的 1.3GB 文件。
- **引入 lint / format 门槛**：前端 ESLint + Prettier，后端 ruff。门槛设为 "no error"，不强制全量存量代码立刻合规，新改动必须过。
- **建立版本基线**：`package.json` version 0.0.0 → 0.1.0，补充 `engines`（Node 18+）；后端同步版本常量。
- **修正 README 名实不符**：移除 "O(1) Virtual Scrolling" / Canvas 渲染的误导表述，改为准确的 DOM 虚拟滚动描述。
- **补 changelog 机制**：基于 Conventional Commits 自动生成 CHANGELOG.md（个人用简化版，不引入 release-please 全流程）。

## Capabilities

### New Capabilities
- `ci-pipeline`: 定义 CI 的触发条件、测试/构建/检查步骤与产物（个人项目主分支推送 + PR 双触发，测试失败即红）。
- `code-quality-gates`: 定义前端 ESLint/Prettier 与后端 ruff 的配置、门槛标准（no error）与提交前校验方式。

### Modified Capabilities
- `project-docs`: README 的能力描述需与实际实现对齐（DOM 虚拟滚动替代 Canvas 渲染表述），并将版本号/CHANGELOG 纳入文档体系导航。

## Impact

- **新增**：`.github/workflows/ci.yml`、`eslint.config.*`、`.prettierrc`、`ruff.toml`（或等价配置）、CHANGELOG 生成脚本。
- **修改**：`package.json`（version/engines/scripts）、`README.md`、`AGENTS.md`（补充 lint/CI 命令）、`openspec/specs/project-docs/spec.md`（需求变更）。
- **不改动**：任何业务代码逻辑；不引入新的运行时依赖（全部为 devDependencies / CI 环境）。
- **风险**：CI 首次配置可能出现环境差异（Python 版本、rg 二进制路径），需在 CI 中复用 `bin/<platform>/rg` 的下载/注入策略。
