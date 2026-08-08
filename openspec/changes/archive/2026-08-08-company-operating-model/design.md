## Context

仓库已有完整的开发基建：OpenSpec 工作流（`openspec-cn` CLI + 11 个 opsx-* 命令 + 10 个 openspec-* 技能）、ATDD 规矩（先写验收测试再实现，红→绿）、grill-me/grilling 对抗式评审技能、CI 硬闸门（push/PR 跑后端 pytest + 前端 tsc/vitest/build）、生产级 e2e 编排（`npm run e2e`）。但整个流程依赖人肉串联：哪个变更该跑什么、跑到哪一步、什么算做完，都靠老板（唯一开发者）记忆与手动执行。

本变更引入"一人公司"运营模型：老板只做 2 个方向性决策（立项、交付审批），中间流程由命令编排 + 子 Agent 自动完成。

## Goals / Non-Goals

**Goals:**
- 提供 5 个 company-* 命令作为流水线编排入口，复用现有 openspec/grill-me/task() 基建，零新 Agent
- 定义角色（4+1）、决策边界、DoD、防呆规则，落成 `docs/COMPANY_MODEL.md` 手册
- 每道闸门生成可追溯的落盘报告（`docs/company-reports/`）+ 对话摘要
- 用 `engineering-foundation` 变更试点验证流程

**Non-Goals:**
- 不修改任何后端/前端业务代码
- 不新建 agent 定义文件（跑顺后再按需固化）
- 不接入定时调度/后台常驻进程（触发仍是老板显式运行命令）
- 不改动现有 openspec-* 命令与技能的既有行为

## Decisions

### D1: 命令即编排层（markdown prompt），不写脚本

5 个 company-*.md 命令是 OpenCode 斜杠命令（prompt 模板），由主 Agent 执行时解读并调度。不写 shell/python 脚本。

**理由**：命令文件能直接引用现有技能/命令（`/opsx-*`、grill-me），由 Agent 自然编排；脚本则需重实现所有现有流程，重复造轮子。OpenCode 的斜杠命令是既有模式（现有 11 个 opsx-* 即如此）。
**备选**：shell 脚本 `scripts/company.sh`——否决，无法内联调用 Agent 技能，编排能力弱。

### D2: 角色落地映射（监管=主 Agent，工作/回归/评审=现有 Agent 与技能）

| 角色 | 落地方式 |
|---|---|
| 设计评审 | grill-me/grilling 技能（已存在） |
| 监管 | 主 Agent（Sisyphus）执行 company-* 命令时兼任：调度、把关、拆任务、查越界 |
| 工作 | `task()` 调度 sisyphus / `openspec-apply` 技能 |
| 回归 | 命令内显式执行：`openspec-cn validate` + 相关 pytest + `tsc --noEmit`/`ruff` + `git diff --name-only` 越界核对；UI 变更加 e2e |
| 汇报 | 命令末段生成对话摘要 + 写 `docs/company-reports/<变更名>-<日期>.md` |

**理由**：盘点确认项目无自定义 agent 定义，且现有 agent/技能已覆盖全部职责；加 agent 定义层收益低、维护成本高。
**备选**：新建 supervisor/reporter/regression 三个 agent md——否决（Q11 决策：先命令跑通再固化）。

### D3: 数据源即状态（无额外状态文件）

公司状态 = `openspec-cn list --json`（变更与任务进度）+ `docs/company-reports/`（历史报告）+ 每个变更的 tasks.md checkbox。

**理由**：OpenSpec 已是权威状态源，公司账本不需要第二份；避免状态漂移。

### D4: 闸门暂停 = 命令内显式"等待老板"

company-run 在两道闸门（规格定稿、回归通过后）输出汇报摘要并询问老板"继续/修改/打回"，老板答复后才推进。紧急升级（回归连败 3 次/规格歧义/越界）同样停在闸门处。

**理由**：draft-only 铁律（indebtio 验证）+ 反无界自主（GitHub Blog 反模式）。

### D5: DoD 分级（Q6/Q10 决策落地）

- 所有变更：OpenSpec 产出物齐全、验收测试红→绿、相关测试 + 静态门通过、`openspec-cn validate` 通过、无遗留调试输出
- UI/交互变更追加：e2e 通过
- 全量回归由 CI 承担（push/PR 自动），本地回归只跑相关测试 + 静态门（快）

## Risks / Trade-offs

- [命令依赖主 Agent 解读质量] → 命令 prompt 写得非常具体（步骤、闸门、证据要求），且每个命令独立可跑，便于逐步校准
- [老板被闸门询问打断] → 2 闸门模式本就允许打断；升级场景有明确触发条件（连败 3 次等），不会无端打扰
- [报告文件堆积] → 每变更一文件，按日期命名；历史报告进 git 作公司史，可后续归档
- [试点失败] → 试点选 `engineering-foundation`（纯基建、无 UI、风险低）；流程缺陷在试点期暴露并修正，不影响业务代码
- [命令与 opsx-* 行为漂移] → company-* 只做编排不重实现，内部调用现有命令/技能，行为由源命令保证

## Migration Plan

1. 本变更落地：手册 + 5 命令 + 报告机制
2. 试点：`engineering-foundation` 跑一个完整循环，验证闸门/汇报/升级
3. 复盘调整：按试点反馈修改命令细节（不涉及本变更则另开变更）
4. 后续变更默认走 `/company-run` 驱动

## Open Questions

- 无（第 3 轮 grilling 已闭合全部决策）
