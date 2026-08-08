## Why

单人维护 loglayer 项目时，开发流程（规格 → 验收测试 → 实现 → 验证 → 归档）依赖人肉记忆与手动串联，老板（唯一开发者）被细节决策淹没，无法专注于方向性判断。需要一个"一人公司"式的自主化开发模型：老板只做少量方向性决策（立项、交付审批），监管/工作/回归/汇报等环节由子 Agent 按固定流水线自动完成，并与仓库已有的 OpenSpec + ATDD + grill-me 基建无缝衔接。

## What Changes

- 新增 5 个斜杠命令（`.opencode/commands/company-*.md`），编排完整开发循环：
  - `/company-init`：老板立项，登记 backlog 并批准变更
  - `/company-spec`：只跑规格阶段（grill-me 设计评审闸门 + OpenSpec 产出物 + 验收测试先红）
  - `/company-review`：只跑评审/回归阶段（verify + 相关测试 + 静态门 + git diff 越界检查 + 汇报）
  - `/company-run <变更名>`：一键串联 规格→ATDD→实现→回归→汇报 全流程
  - `/company-report`：今日状态总览（各变更进度 + 待老板决策项）
- 新增运营手册 `docs/COMPANY_MODEL.md`：定义角色（4+1）、老板决策边界（2 常设闸门 + 紧急升级）、完成定义（DoD）、防呆规则（draft-only、证据制、越界检查、熔断、卡壳即问）
- 新增落盘报告机制：每道闸门生成 `docs/company-reports/<变更名>-<日期>.md`，进 git 可追溯
- 复用现有基建，零新 Agent：内部调度现有 openspec-* 技能/命令、`task()` 子 Agent（sisyphus 工作 / oracle 评审 / explore 检查）、grill-me 技能
- 试点跑通 `engineering-foundation` 变更（0/25），验证流程后固化

## Capabilities

### New Capabilities

- `company-operating-model`: 一人公司开发模型的完整定义——角色职责、老板决策边界（2 闸门 + 紧急升级规则）、完成定义（DoD）、防呆规则、开机仪式
- `company-commands`: 5 个 company-* 斜杠命令的编排行为——各自触发哪些阶段、调用哪些现有基建、闸门如何暂停等老板决策
- `company-reports`: 落盘报告机制——报告文件格式、存放位置、生成时机、对话摘要呈现方式

### Modified Capabilities

<!-- 无既有 spec 需求变更 -->

## Impact

- **新增文件**：`.opencode/commands/company-init.md`、`company-run.md`、`company-spec.md`、`company-review.md`、`company-report.md`；`docs/COMPANY_MODEL.md`；`docs/company-reports/` 目录（运行时生成）
- **受影响代码**：无后端/前端业务代码改动；仅新增 Agent 编排层（命令与文档）
- **依赖**：现有 openspec-cn CLI、grill-me/grilling 技能、task() 子 Agent 调度能力
- **流程影响**：后续所有功能/修复变更建议经由 `/company-run` 驱动，回归闸门在本地自动执行（CI 全量回归仍为硬闸门）
