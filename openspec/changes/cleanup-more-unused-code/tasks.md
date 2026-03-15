## 1. 验证阶段

- [ ] 1.1 使用 grep 确认 CanvasRenderer.ts 无引用
- [ ] 1.2 使用 grep 确认 sqlParser.ts 无引用
- [ ] 1.3 使用 grep 确认 jsonTree.ts 无引用

## 2. 删除未使用的 Utils 文件

- [ ] 2.1 删除 utils/CanvasRenderer.ts
- [ ] 2.2 删除 utils/sqlParser.ts
- [ ] 2.3 删除 utils/jsonTree.ts

## 3. 删除对应的测试文件

- [ ] 3.1 删除 utils/sqlParser.test.ts
- [ ] 3.2 删除 utils/jsonTree.test.ts

## 4. 验证构建

- [ ] 4.1 运行 npm run build 确认无编译错误
- [ ] 4.2 运行 npm test 确认测试通过