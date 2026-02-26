## ADDED Requirements

### Requirement: AI Provider 类型支持

系统 SHALL 支持三种 AI Provider 类型：
- `none`：完全禁用 AI 功能
- `openai`：使用 OpenAI 兼容 API
- `ollama`：使用本地 Ollama 服务

#### Scenario: 用户选择 none provider
- **WHEN** 用户在设置中选择 provider 为 "none"
- **THEN** AI 相关功能完全禁用，界面不显示 AI 功能入口

#### Scenario: 用户选择 openai provider
- **WHEN** 用户在设置中选择 provider 为 "openai"
- **THEN** 界面显示 model 和 apiKey 配置项，用户可输入并保存

#### Scenario: 用户选择 ollama provider
- **WHEN** 用户在设置中选择 provider 为 "ollama"
- **THEN** 界面显示 model、baseUrl、apiKey 配置项

### Requirement: 动态配置 UI

根据选择的 provider 类型，界面 SHALL 动态显示相应的配置项。

#### Scenario: 切换 provider 后配置项更新
- **WHEN** 用户切换 provider 类型
- **THEN** 界面立即更新显示对应 provider 所需的配置项

### Requirement: 模型列表获取

系统 SHALL 支持获取当前 provider 的可用模型列表。

#### Scenario: 获取 OpenAI 模型列表
- **WHEN** 用户选择 openai provider 并配置了 apiKey
- **THEN** 系统从 OpenAI API 获取可用模型列表并显示

#### Scenario: 获取 Ollama 模型列表
- **WHEN** 用户选择 ollama provider 并配置了 baseUrl
- **THEN** 系统从 Ollama API 获取可用模型列表并显示

#### Scenario: None provider 无模型列表
- **WHEN** 用户选择 none provider
- **THEN** 模型列表为空，禁用模型选择

### Requirement: 连接测试

系统 SHALL 提供连接测试功能，验证 AI provider 配置是否正确。

#### Scenario: 测试连接成功
- **WHEN** 用户点击"测试连接"按钮
- **THEN** 系统尝试连接并在界面上显示连接结果（成功/失败）

### Requirement: 配置持久化

AI 配置 SHALL 被持久化保存，重启应用后配置保持有效。

#### Scenario: 配置保存后重启
- **WHEN** 用户保存 AI 配置后重启应用
- **THEN** 应用加载时自动恢复之前的 AI 配置
