# 汇报 · company-scope-verification · 2026-08-08

## 阶段: 回归通过（Gate 2 待审批）

## 变更概况

修复试点暴露的模型级缺陷：单工作区多变更并发时，company-review 越界检查无法自动判定文件归属（试点中 102 个未提交文件分属 4 个变更）。引入**变更级文件登记表（scope.md）+ 归属并集判定**。

## 设计评审闸门（grill-me）

- 方案对抗式评估：变更级文件登记（推荐）vs 分支隔离（当前多 Agent 共享工作区，不可行）vs 暂存区分离（工作区已混改，不可行）
- 决策：scope.md 纯文档层、零侵入，随变更生命周期归档，符合"数据源即状态"原则

## 改动摘要

| 类别 | 文件 | 说明 |
|:-----|:-----|:-----|
| 命令改造 | `.opencode/commands/company-spec.md` | 规格阶段产出物完成后生成 scope.md（新增/修改/删除三组，支持目录/glob） |
| 命令改造 | `.opencode/commands/company-review.md` | 越界检查改为归属并集判定：命中本变更 ✓ / 命中他变更（标记不升级）/ 无归属（升级）；scope.md 缺失校验 |
| 手册 | `docs/COMPANY_MODEL.md` | 防呆规则"越界检查"更新 + 状态与账本章节补充 scope.md |
| 登记表 | 5 个 `openspec/changes/*/scope.md` | 本变更（示范）+ ai-assistant-features / per-tab-find-widget / refactor-bridge-module / engineering-foundation 补生成 |
| 验收测试 | `tests/unit/test_company_scope.py` | 5 断言（先红 5 fail → 绿 5 pass） |
| OpenSpec | `openspec/changes/company-scope-verification/` | proposal/specs/design/tasks |

## 测试证据

```
pytest tests/unit/test_company_scope.py     → 5 passed（红→绿：5 fail → 5 pass）
pytest tests/unit/ tests/integration/        → 112 passed
ruff check backend tests                    → All checks passed!
openspec-cn validate company-scope-verification → 验证通过
```

## 越界检查（本变更，按新规则自证）

- 本变更改动：company-spec.md / company-review.md / COMPANY_MODEL.md / 5×scope.md / test_company_scope.py / 变更产出物 → 全部命中本变更 scope.md ✓
- 无他变更文件被误动；无无归属改动

## DoD 核对

- [x] OpenSpec 产出物齐全
- [x] 验收测试先红后绿（5 fail → 5 pass）
- [x] 相关测试 + 单测通过（112 passed）
- [x] 静态门干净（ruff passed）
- [x] `openspec-cn validate` 通过
- [x] 无遗留调试输出
- [x] 非 UI 变更，e2e 不适用
- [x] scope.md 已生成（本变更 + 4 个活跃变更补登记）

## 风险与待决策项

- **待决策（Gate 2）**：是否批准交付本变更（归档 `company-scope-verification`）？
- **说明**：为其他活跃变更补生成的 scope.md 基于其 proposal Impact 推断，若与实际实现偏差，由各变更自身 review 时校验修正
- **说明**：`engineering-foundation` 的 Gate 2（归档）仍挂起，待老板推送 CI 绿灯后一并处理

## 报告路径

`docs/company-reports/company-scope-verification-2026-08-08.md`
