# Tasks: refine-company-process

## 1. 运营手册（COMPANY_MODEL.md）

- [x] 1.1 在 `docs/COMPANY_MODEL.md` 第 7 节"试点与演进"扩展"流程演进与自学习闭环"章节，描述完整链路：复盘输入（报告「本次循环问题」小节）→ 待提炼可见（company-report「待提炼问题 N 条」）→ 老板触发提炼 → 改进提案 → 立项审批（/company-init）后修改流程文件
- [x] 1.2 在手册角色表中更新"设计评审（+1）"角色说明，加入量化约束：每产出物至少 3 轮诘问、其中至少 1 条为「挑战隐含假设」类问题
- [x] 1.3 在手册产出物要求处加入第一性原理要求：proposal 须包含「根本问题」小节（根本动机、约束、为何现在）
- [x] 1.4 在手册防呆规则或演进章节加入"提炼落地需立项"规则：代理不得直接自改流程文件，改进须经老板批准立项

## 2. 命令编排（.opencode/commands/）

- [x] 2.1 修改 `company-spec.md`：评审闸门步骤量化（每产出物至少 3 轮诘问、至少 1 条挑战隐含假设）；proposal 生成要求增加「根本问题」小节；规格定稿汇报模板增加「本次循环问题」小节
- [x] 2.2 修改 `company-review.md`：回归报告模板增加「本次循环问题」小节（复盘输入沉淀），并说明无问题标注"无"
- [x] 2.3 修改 `company-run.md`：汇报模板增加「本次循环问题」小节；说明自学习闭环（问题沉淀 → 待提炼可见 → 老板触发提炼 → 立项落地）
- [x] 2.4 修改 `company-report.md`：状态摘要增加「待提炼问题 N 条」汇总（扫描 `docs/company-reports/` 中「本次循环问题」小节非空条目），列出来源报告，并提示老板可触发提炼

## 3. 验收测试（先红后绿）

- [x] 3.1 扩展 `tests/unit/test_company_commands.py`：company-spec 断言增加「3 轮」「挑战隐含假设」「根本问题」；company-report 断言增加「待提炼问题」；company-run/review 断言增加「本次循环问题」
- [x] 3.2 新增 `tests/unit/test_company_self_learning.py`：断言 COMPANY_MODEL.md 含自学习闭环链路要素（复盘输入/待提炼/老板触发/立项落地/3 轮/挑战隐含假设/根本问题），报告模板含「本次循环问题」
- [x] 3.3 运行验收测试确认红（先红后绿基线），记录失败输出

## 4. 对齐与校验

- [x] 4.1 核对手册/命令/specs 三处一致（自学习闭环、评审量化、第一性原理要素同步出现）
- [x] 4.2 运行 `openspec-cn validate refine-company-process` 通过
- [x] 4.3 生成 scope.md 文件登记表（新增/修改文件清单）
