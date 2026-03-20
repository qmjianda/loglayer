# AI 辅助 E2E 测试生成提示词

## 🤖 如何使用 AI 生成测试

### 基础提示词模板

```
请为 LogLayer 项目的 [功能名称] 功能编写 Playwright E2E 测试。

功能描述：
[详细描述功能的行为和预期结果]

测试场景：
1. [场景 1]
2. [场景 2]
3. [场景 3]

要求：
- 使用 Playwright 测试框架
- 包含适当的等待和断言
- 失败时自动截图
- 遵循 AAA 模式 (Arrange-Act-Assert)
```

### 示例提示词

#### 示例 1：测试按钮点击

```
请为 LogLayer 的设置按钮编写 Playwright E2E 测试。

功能描述：
点击设置按钮应该打开设置面板，用户可以修改主题和语言设置。

测试场景：
1. 点击设置按钮，验证设置面板打开
2. 切换主题，验证主题变化
3. 关闭设置面板

要求：
- 使用 Playwright 测试框架
- 包含适当的等待和断言
- 失败时自动截图
```

#### 示例 2：测试文件上传

```
请为 LogLayer 的日志文件上传功能编写 Playwright E2E 测试。

功能描述：
用户可以通过文件选择器上传日志文件，上传后应该在 UI 中显示文件名和内容。

测试场景：
1. 点击文件上传按钮
2. 选择测试日志文件
3. 验证文件加载成功
4. 验证日志内容显示

要求：
- 使用 Playwright 的 setInputFiles API
- 等待文件加载完成
- 验证 UI 状态变化
```

#### 示例 3：测试搜索功能

```
请为 LogLayer 的日志搜索功能编写 Playwright E2E 测试。

功能描述：
用户可以在搜索框输入关键词，系统应该高亮显示匹配的日志行。

测试场景：
1. 在搜索框输入关键词
2. 验证搜索结果高亮显示
3. 清除搜索，验证高亮消失
4. 测试特殊字符搜索

要求：
- 使用 Playwright 的 fill 和 clear API
- 验证搜索结果数量
- 测试边界情况
```

## 🎯 AI 生成测试的最佳实践

### 1. 提供清晰的上下文

```
✅ 好：LogLayer 是一个日志查看工具，使用 React + Vite 构建。
      主要功能包括：文件加载、图层管理、搜索、多标签页。

❌ 差：帮我写个测试。
```

### 2. 指定具体的选择器策略

```
✅ 好：优先使用 aria-label 和 role 选择器，
      避免使用易碎的 CSS 类名。

❌ 差：随便用什么选择器。
```

### 3. 定义明确的预期结果

```
✅ 好：点击后应该在 500ms 内显示模态框，
      模态框应该包含"确定"和"取消"按钮。

❌ 差：点击后应该正常工作。
```

### 4. 包含边界情况

```
✅ 好：测试空输入、超长文本、快速连续点击、
      网络延迟等情况。

❌ 差：只测试正常流程。
```

## 📋 常见测试模式

### 模式 1：页面加载测试

```javascript
test('应该加载页面', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/LogLayer/);
  await expect(page.locator('#root')).toBeVisible();
});
```

### 模式 2：用户交互测试

```javascript
test('应该响应用户点击', async ({ page }) => {
  await page.click('button:has-text("提交")');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

### 模式 3：表单测试

```javascript
test('应该提交表单', async ({ page }) => {
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  await expect(page.locator('.confirmation')).toBeVisible();
});
```

### 模式 4：视觉回归测试

```javascript
test('应该匹配快照', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});
```

### 模式 5：API 集成测试

```javascript
test('应该从 API 加载数据', async ({ page }) => {
  const [response] = await Promise.all([
    page.waitForResponse('/api/data'),
    page.click('button:has-text("加载")')
  ]);
  expect(response.status()).toBe(200);
});
```

## 🔧 调试 AI 生成的测试

### 问题 1：选择器找不到元素

**解决：**
```javascript
// 使用 Playwright Inspector
// 运行：npx playwright codegen http://localhost:5173

// 或者使用更稳健的选择器
await page.getByRole('button', { name: '提交' }).click();
await page.getByLabel('用户名').fill('test');
await page.getByPlaceholder('请输入...').fill('value');
```

### 问题 2：竞态条件

**解决：**
```javascript
// 避免使用固定等待
// ❌ await page.waitForTimeout(5000);

// 使用显式等待
// ✅ await page.waitForLoadState('networkidle');
// ✅ await expect(locator).toBeVisible();
// ✅ await page.waitForResponse('/api/data');
```

### 问题 3：测试不稳定

**解决：**
```javascript
// 添加重试机制
test.describe.configure({ mode: 'parallel' });
test.use({ actionTimeout: 10000 });

// 或者在配置文件中设置
// playwright.config.ts: retries: 2
```

## 📚 进阶技巧

### 1. 使用 Page Object 模式

```javascript
class LogLayerPage {
  constructor(page) {
    this.page = page;
    this.settingsButton = page.getByLabel('设置');
    this.searchInput = page.getByPlaceholder('搜索日志...');
  }

  async goto() {
    await this.page.goto('/');
  }

  async openSettings() {
    await this.settingsButton.click();
  }

  async search(query) {
    await this.searchInput.fill(query);
  }
}

// 测试中使用
test('应该搜索日志', async ({ page }) => {
  const logLayer = new LogLayerPage(page);
  await logLayer.goto();
  await logLayer.search('error');
});
```

### 2. 参数化测试

```javascript
const testCases = [
  { query: 'error', expectedCount: 5 },
  { query: 'warning', expectedCount: 3 },
  { query: 'info', expectedCount: 10 },
];

for (const { query, expectedCount } of testCases) {
  test(`应该搜索 "${query}"`, async ({ page }) => {
    // 测试代码
  });
}
```

### 3. 自定义断言

```javascript
expect.extend({
  async toHaveLogEntries(page, expectedCount) {
    const entries = await page.locator('.log-entry').count();
    const pass = entries === expectedCount;
    return {
      pass,
      message: () => 
        `expected ${expectedCount} log entries, got ${entries}`,
    };
  },
});
```

## 🚀 快速开始

1. **描述功能** - 告诉 AI 你要测试什么
2. **生成测试** - AI 生成 Playwright 测试代码
3. **运行测试** - `npm run test:e2e`
4. **调试修复** - 使用 UI 模式调试
5. **提交代码** - 将测试加入版本控制

---

**提示：** 保存常用的提示词模板，下次可以直接复用！
