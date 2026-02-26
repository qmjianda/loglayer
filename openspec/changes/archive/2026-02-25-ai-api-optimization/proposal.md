## Why

当前 LogLayer 的 AI 功能设计不够灵活，只支持固定的 provider 类型，且缺乏对"无 AI"场景的处理。用户需要更灵活的配置方式来支持不同的 AI API 提供商，同时需要更简洁的配置体验。

## What Changes

1. **扩展 AI Provider 支持**：支持三种模式：
   - **无 AI (none)**：完全禁用 AI 功能
   - **OpenAI 兼容 API**：支持任意兼容 OpenAI API 格式的服务商（如 OpenAI、Azure OpenAI、Cloudflare Workers AI 等）
   - **Ollama**：支持本地 Ollama 服务

2. **优化配置流程**：
   - 简化配置界面，根据选择的 provider 动态显示相关配置项
   - 自动检测和获取可用模型列表
   - 提供连接测试功能

3. **统一配置接口**：
   - 整合现有 `heuristic` provider 到更合理的架构中
   - 规范化 base_url、api_key 等配置项的命名和行为

## Capabilities

### New Capabilities

- **ai-provider-unified**: 统一的 AI Provider 架构，支持 none/openai/ollama 三种类型，统一配置管理和连接逻辑

### Modified Capabilities

- 现有 AI 相关功能需要适配新的 provider 架构

## Impact

- 前端：`hooks/useAISettings.ts` 需要重构以支持新的 provider 类型
- 后端：`backend/ai/` 目录需要调整服务架构
- 配置文件：需要适配新的配置结构
