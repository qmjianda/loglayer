## Context

LogLayer 当前依赖 `docs/` 下 7 份 markdown 作为 AI 会话上下文，其中 PROGRESS.md（状态）、CONTEXT.md（现状）、AI_SESSION.md（模板）在 2026-02 后停更，与 openspec 中持续演进的 dockview 分屏、preload 优化、AI 助手等变更严重脱节。openspec 已承载需求、决策轨迹与变更状态，但缺乏"会话启动级"的概况与架构地图；docs 则具备全局视图但无维护机制。本设计将二者重新分层。

## Goals / Non-Goals

**Goals:**
- 建立单一会话入口：AGENTS.md 一次读完即得概况、规则、命令、架构、导航。
- 消除状态类文档：进度/待办由 openspec 命令实时查询。
- 明确各文档性质归属：规范 → opsx，培训/深潜 → docs，模板 → .opencode/commands。
- 保留并冻结历史 ADR，转存待决策项到 openspec backlog。

**Non-Goals:**
- 不把 CONTEXT.md 逐字迁移到 openspec（架构快照走 AGENTS.md 粗略地图）。
- 不建立 openspec 架构综述 capability（违反"无变更时无 spec"哲学）。
- 不重写 LAYER_DEV_GUIDE / INDEXING_OPTIMIZATION 内容本身。

## Decisions

### D1: AGENTS.md 采用"唯一入口 + 导航指针"结构
**选择**：AGENTS.md 承载概况/规则/命令/粗略架构地图，深潜内容仅保留指针。
**理由**：AI 新会话 <3 分钟建立心智模型；避免入口文件膨胀。
**备选**：独立 ARCHITECTURE.md —— 需额外维护纪律，且模块地图一年变更有限，不值得第二套系统。

### D2: 架构地图为"出发坐标"而非权威描述
**选择**：AGENTS.md 中的地图只给模块与数据流骨架，明确标注"以代码为准"。
**理由**：地图会过期，但 AI 可读代码核实；保留它只为省去首次定位成本。
**备选**：详尽接口清单 —— 与 main.py/bridge_client.ts 重复，双重维护必腐化。

### D3: 状态类信息一律查询而非记录
**选择**：删除 PROGRESS.md；进度经 `openspec-cn list/status --json` 获取。
**理由**：查询型状态永远新鲜，手写快照必然过期（本次 5 个月断层即为证据）。
**备选**：保留手写进度文档 —— 依赖纪律，已证明不可行。

### D4: TD-001~008 冻结，TD-009~010 转 backlog
**选择**：历史 ADR 保留为冻结文档不再追加；待决策项开新 openspec 变更提案。
**理由**：决策"为什么"是半永久资产，进度是瞬时资产；当前 TD 文档混了两类。
**备选**：整份删除 —— 丢失虚拟滚动/图层/mmap 决策背景，不可接受。

### D5: AI_SESSION.md 迁入 .opencode/commands/
**选择**：会话模板按工作流对待，移入命令/技能体系，而非知识文档。
**理由**：模板是"如何工作"，与知识内容分离，避免混读。

## Risks / Trade-offs

- [AGENTS.md 架构地图仍会过时] → 明确"以代码为准"，且地图保持粗略，变更时顺手更新成本极低。
- [删 CONTEXT.md 后丢失接口/限制细节] → 关键接口与已知限制压入 AGENTS.md 小节；深层细节 AI 直接读 main.py。
- [openspec 归档后 spec 更新怠惰（现有 Purpose TBD 先例）] → 本变更归档时即补全 purpose；后续归档流程关注该问题（可选独立小变更）。
- [新会话不再读 4 个 docs，可能漏掉 LAYER_DEV_GUIDE] → AGENTS.md 明确写出"图层开发时读此指南"的触发条件。

## Migration Plan

1. 重写 AGENTS.md（概况/命令/架构地图/规范/导航指针 + 关键接口与限制小节）。
2. 删除 docs/PROGRESS.md、docs/CONTEXT.md。
3. 迁移 docs/AI_SESSION.md → .opencode/commands/。
4. 分拆 docs/TECHNICAL_DECISIONS.md（冻结 ADR 保留，TD-009/010 记录为 backlog）。
5. 更新 docs/README.md 为精简导航，核对 AGENTS.md 内所有引用。

## Open Questions

- TD-009（主题系统）、TD-010（插件系统）是否应即刻各自开变更提案，还是合并为一个 backlog 记录？
- LAYER_DEV_GUIDE / INDEXING_OPTIMIZATION 是否长期留在 docs/，还是未来并入对应 capability spec？
