## Context

当前 LogLayer AI 功能架构：
- **Provider 类型**：heuristic（启发式）、openai、ollama 三种
- **问题**：
  1. heuristic 作为 fallback 逻辑嵌入在 service.py 中，不够灵活
  2. 缺乏"无 AI"模式，用户必须选择一种 provider
  3. 配置项（api_key、base_url）命名不够规范
  4. 前端配置界面与后端配置耦合，不够灵活

## Goals / Non-Goals

**Goals:**
- 支持 none/openai/ollama 三种 provider 类型
- 前端根据选择的 provider 动态显示配置项
- 自动获取可用模型列表
- 统一后端 provider 架构

**Non-Goals:**
- 不实现新的 AI 能力，仅优化配置架构
- 不改变现有的 AI 功能行为

## Decisions

### Decision 1: Provider 枚举改为 none/openai/ollama

**选项 A**：保留 heuristic 作为 provider 选项
**选项 B**：将 heuristic 改为 "none"，完全禁用 AI

**选择**：B - 语义更清晰，"none" 表示不使用 AI

### Decision 2: 前端动态配置 UI

**选项 A**：前端 hardcode 每种 provider 的配置字段
**选项 B**：后端提供 provider 的 schema，前端动态渲染

**选择**：B - 更灵活，扩展新 provider 时前端无需修改

### Decision 3: 配置命名规范

**选项 A**：保持 snake_case（api_key, base_url）
**选项 B**：改为 camelCase（apiKey, baseUrl）

**选择**：B - 与 TypeScript/JavaScript 习惯一致

## Risks / Trade-offs

- [Risk] 现有 heuristic 的 fallback 逻辑需要重新设计
  - [Mitigation] 将 heuristic 能力封装为独立的 service，不与 provider 绑定
- [Risk] 配置兼容性，旧配置需要迁移
  - [Mitigation] 在加载配置时做兼容处理
