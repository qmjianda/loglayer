# Tasks: docs-restructure

## 1. AGENTS.md 重构

- [x] 1.1 重写 AGENTS.md：项目概况、技术栈、命令（dev/test/build/打包）
- [x] 1.2 新增粗略架构地图（backend/bridge→loglayer→main.py→pywebview→React/LogViewer 数据流）
- [x] 1.3 增加"关键接口"小节（REST 端点 + WS 信号）与"已知限制"小节（原 CONTEXT 抢救内容）
- [x] 1.4 更新"新会话先读"指引：仅读 AGENTS.md + 运行 `openspec-cn list --json`，去掉 4 文档指引
- [x] 1.5 核对并更新文档引用（LAYER_DEV_GUIDE / INDEXING_OPTIMIZATION / TECHNICAL_DECISIONS 指针）

## 2. 删除状态与现状文档

- [x] 2.1 删除 docs/PROGRESS.md
- [x] 2.2 删除 docs/CONTEXT.md

## 3. 模板迁移

- [x] 3.1 迁移 docs/AI_SESSION.md 到 .opencode/commands/（或技能体系），适配 opsx 工作流
- [x] 3.2 移除 AGENTS.md 中对 docs/AI_SESSION.md 的引用

## 4. 决策文档分拆

- [x] 4.1 TECHNICAL_DECISIONS.md 标记为冻结（头部注明不再追加，历史决策链保留）
- [x] 4.2 将 TD-009（主题系统）、TD-010（插件系统）记录为 openspec backlog（新变更提案或 backlog 文档）
- [x] 4.3 移除已冻结文档中的"待决策"章节

## 5. 导航与收尾

- [x] 5.1 更新 docs/README.md 为精简导航（指向 AGENTS.md + 深潜文档）
- [x] 5.2 全局核对引用：grep 残留的 PROGRESS/CONTEXT/AI_SESSION 引用并修正
- [x] 5.3 归档本变更前验证：新会话仅凭 AGENTS.md + openspec 命令可完成启动（dry-run 检查）
