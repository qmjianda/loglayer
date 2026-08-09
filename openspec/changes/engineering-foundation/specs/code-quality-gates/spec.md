## ADDED Requirements

### Requirement: 前端 lint/格式化门槛

系统 SHALL 提供前端 ESLint 与 Prettier 配置，并以 "no error" 为门槛：`eslint --max-warnings 0` 与格式化检查失败即视为构建失败。

#### Scenario: 存在 lint error 的提交被拦截

- **WHEN** 前端代码包含 ESLint error（如未使用变量、显式 `any` 违规等被规则标记项）
- **THEN** `npm run lint` 退出码非零
- **AND** CI/本地校验将该提交标记为失败

#### Scenario: 格式不一致被检出

- **WHEN** 前端代码不符合 Prettier 格式约定
- **THEN** `npm run format:check` 退出码非零
- **AND** 可通过 `npm run format` 自动修复

### Requirement: 后端 lint 门槛

系统 SHALL 提供后端 ruff 配置，并以 "no error" 为门槛：`ruff check` 检出错误即失败。

#### Scenario: 存在 lint error 的 Python 代码被拦截

- **WHEN** 后端代码包含 ruff 标记的错误（未使用导入、未定义变量等）
- **THEN** `ruff check backend` 退出码非零
- **AND** CI/本地校验将该提交标记为失败

### Requirement: 存量代码渐进合规

系统 SHALL 允许存量代码在引入 lint 时存在 warning 而不阻塞，但新改动不得引入 error；门槛聚焦 error 而非强制一次性整改全部存量。

#### Scenario: 存量 warning 不阻塞提交

- **WHEN** 存量代码存在未被规则升级覆盖的 warning
- **THEN** 提交仍可通过（error 门槛为 0）
- **AND** warning 在后续改动中逐步收敛
