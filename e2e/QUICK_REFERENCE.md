# 🧪 E2E 测试快速参考

## 运行测试

```bash
# 运行所有测试
npm run test:e2e

# UI 模式（推荐用于编写/调试）
npm run test:e2e:ui

# 有头模式（可见浏览器）
npm run test:e2e:headed

# 调试模式（逐行）
npm run test:e2e:debug

# 查看报告
npm run test:e2e:report
```

## 常用命令

```bash
# 运行特定测试文件
npm run test:e2e -- smoke.test.ts

# 运行匹配的测试
npm run test:e2e -- --grep "应该加载"

# 只运行 Chromium
npm run test:e2e -- --project=chromium

# 生成测试代码
node tools/generate-e2e-test.js "功能描述"
```

## 常用 API

```typescript
import { test, expect } from '@playwright/test';

test('示例测试', async ({ page }) => {
  // 导航
  await page.goto('/');
  await page.click('button');
  await page.fill('input', 'text');
  
  // 断言
  await expect(locator).toBeVisible();
  await expect(locator).toHaveText('expected');
  await expect(locator).toHaveCount(3);
  
  // 截图
  await page.screenshot({ path: 'test.png' });
  
  // 等待
  await page.waitForLoadState('networkidle');
  await page.waitForResponse('/api/data');
});
```

## 选择器优先级

```typescript
// ✅ 推荐（语义化）
page.getByRole('button', { name: '提交' });
page.getByLabel('用户名');
page.getByPlaceholder('搜索...');
page.getByText('欢迎');

// ⚠️ 谨慎使用
page.locator('.btn-primary');
page.locator('#submit-btn');

// ❌ 避免
page.locator('div > button:nth-child(3)');
```

## 调试技巧

```bash
# 使用 Codegen 录制操作
npx playwright codegen http://localhost:5173

# 使用 Inspector
PWDEBUG=1 npm run test:e2e

# 查看追踪
npx playwright show-trace trace.zip
```

## 文件位置

- **测试文件：** `e2e/*.test.ts`
- **截图：** `e2e/screenshots/`
- **报告：** `playwright-report/index.html`
- **配置：** `playwright.config.ts`
- **文档：** `e2e/README.md`

---

**详细文档：** `e2e/README.md`  
**AI 提示词：** `e2e/AI_TEST_PROMPTS.md`
