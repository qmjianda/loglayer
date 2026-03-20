# LogLayer E2E 测试指南

## 📦 安装

首次运行需要安装 Playwright 浏览器：

```bash
# 安装 Playwright 和 Chromium 浏览器
npx playwright install chromium

# 或者安装所有支持的浏览器
npx playwright install
```

## 🚀 运行测试

### 运行所有 E2E 测试

```bash
# 在后台启动开发服务器并运行测试
npm run test:e2e
```

### 有头模式（可见浏览器）

```bash
# 显示浏览器窗口运行测试
npm run test:e2e:headed
```

### 调试模式

```bash
# 逐行调试测试
npm run test:e2e:debug
```

### UI 模式（推荐用于编写测试）

```bash
# 打开 Playwright UI 界面
npm run test:e2e:ui
```

### 查看测试报告

```bash
# 生成并打开 HTML 报告
npm run test:e2e:report
```

## 📁 测试文件结构

```
e2e/
├── basic-page.test.ts          # 基础页面加载测试
├── component-interaction.test.ts # 组件交互测试
├── core-features.test.ts        # 核心功能测试
├── visual-regression.test.ts    # 视觉回归测试
└── screenshots/                  # 测试截图
    ├── homepage-loaded.png
    ├── settings-panel-open.png
    └── visual/                   # 视觉回归截图
```

## 📝 编写新测试

### 基础模板

```typescript
import { test, expect } from '@playwright/test';

test.describe('功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('应该做某事', async ({ page }) => {
    // 你的测试代码
    await page.click('button');
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

### 常用 API

```typescript
// 导航
await page.goto('/path');
await page.click('button');
await page.fill('input', 'text');

// 断言
await expect(locator).toBeVisible();
await expect(locator).toHaveText('expected');
await expect(locator).toHaveCount(3);

// 截图
await page.screenshot({ path: 'screenshot.png' });

// 等待
await page.waitForTimeout(1000);
await page.waitForLoadState('networkidle');
```

## 🔧 Playwright 配置

配置文件：`playwright.config.ts`

主要配置项：
- `baseURL`: `http://localhost:5173` (Vite 开发服务器)
- `webServer`: 自动启动开发服务器
- `screenshot`: 失败时自动截图
- `video`: 失败时录制视频
- `trace`: 首次重试时记录追踪

## 🎯 测试覆盖

### 已覆盖的功能

- ✅ 基础页面加载
- ✅ 响应式布局
- ✅ 组件交互（设置、主题、侧边栏）
- ✅ 核心功能（文件加载、搜索、图层）
- ✅ 视觉回归测试

### 待添加的测试

- [ ] 文件上传和加载
- [ ] 图层管理（增删改查）
- [ ] 搜索功能
- [ ] 多标签页管理
- [ ] 书签功能
- [ ] 快捷键
- [ ] 后端 API 集成

## 🐛 故障排查

### 测试失败

1. 查看 HTML 报告：`npm run test:e2e:report`
2. 检查截图：`e2e/screenshots/`
3. 使用调试模式：`npm run test:e2e:debug`

### 元素找不到

- 使用 `page.waitForLoadState('networkidle')` 等待加载
- 使用 `await locator.first()` 处理多个匹配
- 检查选择器是否正确

### 超时问题

- 增加超时：`test.setTimeout(60000)`
- 使用显式等待代替 `waitForTimeout`
- 检查开发服务器是否正常启动

## 📊 CI/CD 集成

在 CI 环境中运行：

```yaml
# GitHub Actions 示例
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e
```

## 🤖 AI 辅助测试

使用 AI 生成测试用例：

1. 描述要测试的功能
2. AI 生成 Playwright 测试代码
3. 运行并验证测试
4. 根据需要调整

示例提示：
> "为 LogLayer 的图层拖拽功能编写 E2E 测试"

## 📚 参考资料

- [Playwright 官方文档](https://playwright.dev)
- [Playwright 测试 API](https://playwright.dev/docs/api/class-test)
- [Playwright 最佳实践](https://playwright.dev/docs/best-practices)
