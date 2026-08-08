## 1. 验收测试（ATDD，先红后绿）

- [x] 1.1 编写 `tests/unit/test_company_commands.py`：断言 5 个 company-*.md 命令文件存在于 `.opencode/commands/` 且包含关键编排要素（grill-me 评审闸门、openspec-cn 调用、回归闸门、汇报/报告路径）
- [x] 1.2 编写 `tests/unit/test_company_reports.py`：断言 `docs/company-reports/` 未被 `.gitignore` 忽略、报告文件命名格式 `<变更名>-<日期>.md` 的验证逻辑（辅助函数）
- [x] 1.3 运行验收测试确认红（当前无命令文件/手册，断言应失败）

## 2. 运营手册

- [x] 2.1 编写 `docs/COMPANY_MODEL.md`：4+1 角色章节（设计评审/监管/工作/回归/汇报）
- [x] 2.2 编写老板决策边界章节（2 常设闸门：立项+交付；代理自决范围；`Fix:` 级小额 bug 事后告知）
- [x] 2.3 编写紧急升级规则章节（回归连败 3 次 / 规格歧义 / 越界改动）
- [x] 2.4 编写完成定义 DoD 章节（产出物齐全、验收红→绿、测试+静态门、validate、无调试输出；UI 变更加 e2e）
- [x] 2.5 编写防呆规则章节（draft-only / 证据制 / 越界检查 / 熔断 / 卡壳即问）
- [x] 2.6 编写开机仪式章节（每日 company-report → company-init → company-run → 审批交付）
- [x] 2.7 在 `docs/README.md` 文档索引中加入 COMPANY_MODEL.md

## 3. 编排命令

- [x] 3.1 编写 `.opencode/commands/company-init.md`：立项引导（描述→推导 kebab-case 名→`openspec-cn new change`→输出变更名与下一步）
- [x] 3.2 编写 `.opencode/commands/company-spec.md`：规格阶段（grill-me 评审闸门→proposal/specs/design/tasks 产出物→验收测试落地红）
- [x] 3.3 编写 `.opencode/commands/company-review.md`：回归阶段（validate + 相关测试 + 静态门 + git diff 越界核对 + UI 变更 e2e + 汇报）
- [x] 3.4 编写 `.opencode/commands/company-run.md`：一键全流程（评审→产出物→红→实现→回归→汇报），闸门处暂停等老板
- [x] 3.5 编写 `.opencode/commands/company-report.md`：今日状态（`openspec-cn list --json` + `docs/company-reports/` 汇总 + 待决策项）
- [x] 3.6 每个命令包含防呆要素：证据制（附测试输出/diff）、熔断（连败 3 次升级）、卡壳即问（歧义暂停询问）

## 4. 回归验证

- [x] 4.1 运行验收测试确认绿（命令文件与手册就绪后断言全部通过）
- [x] 4.2 运行 `openspec-cn validate --change company-operating-model` 确认产出物合规
- [x] 4.3 运行仓库回归：`ruff check backend tests`、`npx tsc --noEmit`（确认无新引入问题）
- [x] 4.4 试点：以本变更自身验证完整循环（评审→产出物→红→实现→绿→回归→汇报落盘）；`engineering-foundation` 完整试点待 Gate 2 批准后启动
