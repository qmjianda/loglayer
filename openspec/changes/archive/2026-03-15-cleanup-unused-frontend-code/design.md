## Context

前端代码库中识别出 5 个未被使用的 hooks 及其对应的测试文件。这些文件虽然存在但没有被任何组件导入或使用，删除它们不会影响现有功能。为确保安全，需要在删除前进行充分验证。

## Goals / Non-Goals

**Goals:**
- 安全删除 5 个未使用的 hooks 源文件
- 安全删除 4 个对应的测试文件
- 移除 App.tsx 中的调试 console.log
- 修正 hooks/index.ts 中的误导性注释
- 验证删除后项目可正常编译和运行

**Non-Goals:**
- 不修改 React.FC 写法（改动量大，风险高）
- 不进行组件重构或逻辑变更
- 不删除可能被动态导入的代码

## Decisions

### 1. 删除前验证策略
- 使用 TypeScript 编译器检查类型错误
- 运行构建命令确认无破坏性变更
- **决定**: 先验证再删除，而非先删除后验证

### 2. 测试文件处理
- 源文件删除后，对应的测试文件也必须删除
- **决定**: 批量删除相关测试文件，避免孤立测试

### 3. hooks/index.ts 清理
- 删除 useLoadingState 导出时，同时删除相关注释
- **决定**: 保持其他导出不变，只移除无效部分

## Risks / Trade-offs

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| 误删正在使用的代码 | 低 | 删除前用 grep 确认无引用 |
| 编译失败 | 低 | 删除后运行 npm run build 验证 |
| 影响 CI/CD | 低 | 确保测试通过后再提交 |

## Migration Plan

1. **Step 1**: 使用 grep 再次确认每个文件未被引用
2. **Step 2**: 删除 5 个 hooks 源文件
3. **Step 3**: 删除 4 个测试文件
4. **Step 4**: 修复 App.tsx 中的 console.log
5. **Step 5**: 修正 hooks/index.ts 注释
6. **Step 6**: 运行 `npm run build` 验证
7. **Step 7**: 运行 `npm test` 确认无测试失败

## Open Questions

- 是否需要保留 useLoadingState 的类型定义（虽然实现未使用）？→ **决定**: 不保留，完整删除