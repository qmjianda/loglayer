---
description: 一人公司 - 老板立项（登记新变更并批准 Gate 1）
---

一人公司模型的**立项闸门（Gate 1）**：老板批准"做什么"。

**输入**：`/company-init` 之后的参数是变更描述或已推导的变更名（kebab-case）。

**步骤**

1. **若未提供输入，询问老板要构建什么**

   使用 **AskUserQuestion tool**（开放式）询问：
   > "您想要处理什么变更？请描述您想要构建或修复的内容。"

   根据描述推导 kebab-case 变更名（例如："add user authentication" → `add-user-auth`）。
   **重要**：不了解老板要构建什么，请勿继续。

2. **校验变更名**

   - 非 kebab-case → 请求有效名称
   - 同名变更已存在 → 提示改用 `/company-spec <name>` 继续既有变更

3. **创建变更骨架**

   ```bash
   openspec-cn new change "<name>"
   ```
   默认 schema（spec-driven），除非老板明确指定其他 schema。

4. **展示状态与立项摘要**

   ```bash
   openspec-cn status --change "<name>" --json
   ```
   使用返回的 `changeRoot`、`artifactPaths`、`nextSteps`，不假设路径。

   **输出立项确认**（Gate 1 通过）：
   ```
   ✅ 立项批准：<name>
   - 位置：<changeRoot>
   - 首个产出物：proposal（待创建）
   - 下一步：运行 /company-spec <name> 进入规格阶段（含设计评审闸门）
   ```

5. **收尾**

   提示老板：是否立即运行 `/company-spec <name>` 启动规格阶段。

**护栏**
- 只创建骨架，**不创建任何产出物**（产出物由 `/company-spec` 驱动）
- 不实现任何代码
- 若描述模糊（多个合理解释），暂停请老板澄清——不猜
