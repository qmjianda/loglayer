# Tasks: company-scope-verification

## 1. 验收测试（ATDD，先红后绿）

- [x] 1.1 编写 `tests/unit/test_company_scope.py`：断言 company-spec.md 含 scope.md 生成步骤、company-review.md 含"归属并集判定"要素（本变更/他变更/无归属三类 + `openspec-cn list --json`）
- [x] 1.2 断言 COMPANY_MODEL.md 越界检查规则含归属判定说明
- [x] 1.3 运行验收测试确认红（命令未改造前断言失败）

## 2. scope.md 登记机制

- [x] 2.1 编写 scope.md 模板说明（格式：新增/修改/删除三组，支持目录/glob）并写入 company-spec.md 步骤 3 后
- [x] 2.2 company-spec.md 增加"产出物完成后生成 scope.md"步骤
- [x] 2.3 company-review.md 越界检查改为归属并集判定（本变更命中 ✓ / 他变更标记不升级 / 无归属升级 + 附判定依据）
- [x] 2.4 company-review.md 增加 scope.md 缺失校验（缺失 → 提示回归规格阶段，不误判）

## 3. 手册同步

- [x] 3.1 COMPANY_MODEL.md 防呆规则"越界检查"更新为归属并集判定说明（三类判定 + scope.md 登记）
- [x] 3.2 COMPANY_MODEL.md 状态与账本章节补充 scope.md 说明

## 4. 回归验证

- [x] 4.1 运行验收测试确认绿
- [x] 4.2 为本变更自身生成 `openspec/changes/company-scope-verification/scope.md`（示范登记）
- [x] 4.3 为其他活跃变更补生成 scope.md（ai-assistant-features / per-tab-find-widget / refactor-bridge-module / engineering-foundation）
- [x] 4.4 回归：pytest + ruff + validate，确认无新引入问题
