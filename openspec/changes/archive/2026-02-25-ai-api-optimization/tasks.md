## 1. 后端配置调整

- [x] 1.1 修改 backend/ai/config.py 的 AIProvider 枚举，将 heuristic 改为 none
- [x] 1.2 更新 AIConfig 模型，配置项改用 camelCase（apiKey, baseUrl）
- [x] 1.3 修改 backend/ai/service.py，当 provider 为 none 时返回空结果

## 2. 后端 Provider 架构

- [x] 2.1 创建 NoneProvider 类，处理无 AI 场景
- [x] 2.2 重构 AIService，统一各 provider 的初始化逻辑
- [x] 2.3 实现配置兼容性逻辑，支持旧配置迁移

## 3. 前端配置界面

- [x] 3.1 修改 frontend/src/hooks/useAISettings.ts，provider 类型改为 none/openai/ollama
- [x] 3.2 添加 provider schema 接口，根据 provider 类型动态获取配置字段
- [x] 3.3 更新前端配置 UI，根据 provider 类型显示/隐藏配置项
- [x] 3.4 实现模型列表获取逻辑，根据 provider 类型调用对应 API

## 4. 测试与验证

- [x] 4.1 测试 none provider 完全禁用 AI 功能
- [x] 4.2 测试 openai provider 配置和连接
- [x] 4.3 测试 ollama provider 配置和连接
- [x] 4.4 测试配置持久化，重启后配置保持有效
