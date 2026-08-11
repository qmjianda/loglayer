---
description: 一人公司 - 规格阶段（设计评审闸门 + OpenSpec 产出物 + 验收测试红）
---

一人公司模型的**规格阶段**：设计评审闸门（grill-me）→ OpenSpec 产出物 → 验收测试落地（红）。

**输入**：`/company-spec <变更名>`。若省略，检查对话上下文；歧义则用 AskUserQuestion 让老板选择。

**步骤**

1. **选择变更并确认立项（Gate 1）**

   若老板尚未用 `/company-init` 批准该变更，先确认立项意图再继续。

2. **设计评审闸门（grill-me）**

   **在生成任何产出物之前**，调用 grill-me/grilling 技能对变更方案做对抗式评审：
   - 目标：识别方案漏洞、歧义、隐藏风险、未言明的假设
   - **量化约束**：每产出物至少 **3 轮**诘问，其中至少 1 条为「**挑战隐含假设**」类问题（"因为旧流程这么做的"不是理由）
   - 产出：评审结论（通过 / 需修改 / 打回）+ 关键问题清单

   **闸门规则**：
   - 评审通过 → 继续产出物
   - 需修改 → 先解决清单中的问题再继续（与老板或监管确认）
   - 打回 → 停止，向老板汇报评审结论等待方向决策

3. **按顺序生成 OpenSpec 产出物**

   对每个产出物：
   ```bash
   openspec-cn status --change "<name>" --json     # 找下一个 ready 产出物
   openspec-cn instructions <artifact-id> --change "<name>" --json
   ```
   按指令生成：proposal → specs → design → tasks。
   - proposal 须包含「**根本问题**」小节（该变更解决的根本问题、约束、为何现在）——第一性原理审视
   - 每个 spec 场景必须可测试（WHEN/THEN）
   - 产出物之间保持对齐（specs 覆盖 proposal 的 capabilities，tasks 可追溯到 specs）

4. **生成 scope.md 文件登记表（产出物完成后）**

   在 `openspec/changes/<变更名>/scope.md` 生成变更级文件登记表，登记本变更预期影响/修改的文件路径模式，作为 company-review 越界检查的归属判定依据：

   ```markdown
   # Scope: <变更名>

   ## 新增
   - <文件路径 或 目录/ 或 glob 模式>

   ## 修改
   - <文件路径 或 目录/ 或 glob 模式>

   ## 删除
   - <文件路径 或 目录/ 或 glob 模式>
   ```

   - 按 新增/修改/删除 三组登记，支持目录级（`frontend/src/store/`）与通配（`frontend/src/**/*.tsx`）
   - 保守登记：目录/精确路径优先，通配需显式
   - 产出物确定影响范围后登记最准确；后续实现中如发现超范围改动，须回到本步骤更新 scope.md

5. **验收测试落地（红）**

   从 specs 的 WHEN-THEN 场景逐条落到验收测试：
   - 纯后端/算法逻辑 → `tests/unit/`（`test_<capability>.py`）
   - 跨前后端/UI → `tests/e2e/`；Bug 修复 → `tests/repro/`
   - **运行并确认红**（验收测试失败，符合"先红后绿"）

6. **规格定稿汇报**

   生成落盘报告：`docs/company-reports/<变更名>-<日期>.md`
   ```
   ## 规格阶段完成：<name>
   - 阶段: 规格定稿
   - 产出物: proposal/specs/design/tasks 全部就绪
   - scope.md: 已生成（N 个路径模式）
   - 验收测试: N 个已落地，全部红（先红后绿基线）
   - 评审结论: <通过/需修改>
   - 待老板决策: 无（或列明）
   - 本次循环问题: <暴露的问题与改进建议，无则填"无">（自学习复盘输入）
   ```

6. **闸门暂停，等待老板**

   展示一屏摘要并询问老板：
   > 规格已定稿，验收测试已红。是否进入实现阶段（/company-run <name> 或直接 /opsx-apply）？
   > 或需要先调整规格？

**护栏**
- 不实现任何业务代码（实现由 `/company-run`/`/opsx-apply` 驱动）
- 评审闸门**必须先于产出物**，不可跳过
- 产出物用 CLI 返回的路径，不假设文件名
- 规格歧义 → 暂停询问，不猜
