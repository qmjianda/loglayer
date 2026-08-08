# 汇报 · engineering-foundation · 2026-08-08

## 阶段: 回归通过（Gate 2 待审批）· company-run 首次完整试点

## 变更概况

工程地基变更（CI / lint 门槛 / 版本基线 / README 名实修正 / CHANGELOG）。**注**：本变更实现已于本会话之前完成（tasks 24/25），本次 company-run 补做了：设计评审闸门、验收测试落地（ATDD 缺口修补）、完整回归验证。

## 设计评审闸门（grill-me）

- 产出物一致性核查：proposal/specs(3)/design/tasks 全部 done，`openspec-cn validate` 通过
- 实现与 specs 一致性抽查：version 双端 0.1.0 ✓、README 无 O(1)/Canvas 误导表述 ✓、ci.yml 含 push/PR 双触发 + backend/frontend job ✓、lint 门槛已入 CI ✓
- **发现的缺口**：① ATDD 缺口——specs 场景此前无对应验收测试 → 已补 `tests/unit/test_engineering_foundation.py`（11 断言）；② 任务 6.2 未完成（推送 main 触发 CI，需老板动作）

## 测试证据

```
pytest tests/unit/ tests/integration/       → 105 passed（含新增 11 个验收测试）
npx tsc --noEmit                            → 0 错误
ruff check backend tests                    → All checks passed!
npm run lint                                → 0 error
npm run format:check                        → All matched files use Prettier code style!
vitest                                      → 46 passed / 2 failed
openspec-cn validate engineering-foundation → 验证通过
```

**vitest 2 个失败说明**：`searchStore.test.ts`（`focusRequest` 默认值、`requestFocus` 不存在）属 **per-tab-find-widget** 变更——该变更任务 2.2/5.2 尚未实现，测试先写为预期红，**与本变更无关**（预存在失败，不阻塞本变更 DoD）。

## 越界检查

- **本变更改动范围**：`.github/workflows/ci.yml`（新增）、eslint.config.js/.prettierrc.json/.prettierignore/ruff.toml/cliff.toml/CHANGELOG.md/backend/__init__.py（新增）、package.json（version/engines/scripts）、README.md/AGENTS.md/docs/TECHNICAL_DECISIONS.md/docs/README.md（文档修正）——全部在任务范围内 ✓
- **工作区环境事实**：git 工作区存在 102 个未提交改动文件（14k+ 行），分属 ai-assistant-features / per-tab-find-widget / refactor-bridge-module 等并行变更的进行中工作。**模型级问题（试点发现）**：单工作区多变更并发时，越界检查无法自动区分文件归属，需人工判定 → 建议后续公司模型对多变更并行场景采用分支/工作区隔离或按变更登记文件清单

## DoD 核对

- [x] OpenSpec 产出物齐全（proposal / specs×3 / design / tasks）
- [x] 验收测试存在（本次补写 11 断言，全部通过；历史实现窗口未走红→绿，如实记录）
- [x] 相关测试 + 单测通过（105 passed）
- [x] 静态门干净（tsc 0 / ruff passed / lint 0 error / format 通过）
- [x] `openspec-cn validate` 通过
- [x] 无遗留调试输出
- [x] 非 UI 变更，e2e 不适用（DoD 分级规则）
- [ ] 任务 6.2 未完成：推送 main 触发 CI 绿灯验证（**需老板推送**）

## 待老板决策

1. **Gate 2 交付审批**：批准后归档 `engineering-foundation`？（建议先推送触发 CI 验证 6.2，CI 绿后再归档更稳妥）
2. **模型改进项**（试点发现，另开变更或并入本变更讨论）：
   - 多变更并发时的越界检查归属问题（建议变更级文件登记或分支隔离）
   - 历史已实现变更的 ATDD 补写规范（"红→绿"窗口缺失时的验收策略）

## 报告路径

`docs/company-reports/engineering-foundation-2026-08-08.md`
