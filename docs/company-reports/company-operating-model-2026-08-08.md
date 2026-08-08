# 汇报 · company-operating-model · 2026-08-08

## 阶段: 回归通过（Gate 2 待审批）

## 改动摘要

本变更为 LogLayer 引入"一人公司"自主化开发模型：

| 类别 | 文件 | 说明 |
|:-----|:-----|:-----|
| 运营手册 | `docs/COMPANY_MODEL.md` | 4+1 角色、2 闸门+升级、DoD、防呆规则、开机仪式 |
| 命令 | `.opencode/commands/company-init.md` | 老板立项（Gate 1） |
| 命令 | `.opencode/commands/company-spec.md` | 规格阶段（grill-me 评审闸门 + 产出物 + 验收红） |
| 命令 | `.opencode/commands/company-review.md` | 回归阶段（validate + 测试 + 静态门 + 越界 + 汇报） |
| 命令 | `.opencode/commands/company-run.md` | 一键完整循环 |
| 命令 | `.opencode/commands/company-report.md` | 今日状态（开机仪式入口） |
| 文档索引 | `docs/README.md` | 加入 COMPANY_MODEL.md |
| 验收测试 | `tests/unit/test_company_commands.py` | 6 个命令契约断言 |
| 验收测试 | `tests/unit/test_company_reports.py` | 3 个报告机制断言 |
| OpenSpec | `openspec/changes/company-operating-model/` | proposal/specs(3)/design/tasks |

## 测试证据

```
python3 -m pytest tests/unit/test_company_commands.py tests/unit/test_company_reports.py
→ 9 passed（先红后绿：初跑 6 failed → 实现后 9 passed）

python3 -m pytest tests/unit/ tests/integration/
→ 93 passed（全量单测+集成，无回归）

npx tsc --noEmit        → 0 错误
ruff check backend tests → All checks passed!
openspec-cn validate company-operating-model → 验证通过
```

## 越界检查

`git diff --name-only`：仅新增上述文件，无越界改动（未触碰后端/前端业务代码）。

## DoD 核对

- [x] OpenSpec 产出物齐全（proposal / specs×3 / design / tasks）
- [x] 验收测试先红后绿（6 fail → 9 pass，有证据）
- [x] 相关测试 + 单测通过（9 + 93 passed）
- [x] 静态门干净（tsc 0 错误 / ruff passed）
- [x] `openspec-cn validate` 通过
- [x] 无遗留调试输出
- [x] 非 UI 变更，e2e 不适用（按 DoD 分级规则）

## 风险与待决策项

- **待决策（Gate 2）**：是否批准交付本变更（归档 `company-operating-model`）？
- **待决策**：试点 `engineering-foundation` 的完整循环是否现在启动？（建议：本变更归档后，用 `/company-run engineering-foundation` 验证模型在真实 25 任务变更上的表现）
- **已知边界**：命令依赖主 Agent 解读质量，试点期会暴露并校准；`project-governor` 技能引用的 `PROJECT_MAP.md` 尚不存在（另开变更补齐，不在本变更范围）

## 报告路径

`docs/company-reports/company-operating-model-2026-08-08.md`
