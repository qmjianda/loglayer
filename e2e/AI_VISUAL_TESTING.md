# 🤖 AI 辅助视觉回归测试指南

## 概述

视觉回归测试通过对比 UI 截图来检测意外的视觉变化。结合 AI 可以：
- 智能识别合理变化 vs 意外变化
- 自动忽略动态内容（时间戳、动画等）
- 标记需要人工审核的差异
- 生成详细的差异报告

---

## 工具链

### 1. Playwright 内置截图

```typescript
// 基础截图
await page.screenshot({ path: 'screenshot.png' });

// 全屏截图
await page.screenshot({ path: 'screenshot.png', fullPage: true });

// 元素截图
await element.screenshot({ path: 'element.png' });

// 对比截图（Playwright 原生支持）
await expect(page).toHaveScreenshot('homepage.png');
```

### 2. 视觉对比工具

```bash
# 对比基线和当前截图
node tools/visual-compare.js baseline/ current/ reports/
```

### 3. 第三方服务（可选）

- **Percy** - 视觉测试平台
- **Applitools** - AI 驱动视觉测试
- **Chromatic** - Storybook 视觉测试
- **VRT** - 开源视觉回归工具

---

## 使用流程

### 步骤 1：建立基线

```bash
# 运行视觉回归测试
npm run test:e2e -- visual-regression.test.ts

# 将截图保存为基线
cp -r e2e/screenshots/visual/ e2e/screenshots/baseline/
```

### 步骤 2：执行测试

```bash
# 运行测试生成新截图
npm run test:e2e -- visual-regression-v2.test.ts

# 将新截图保存到 current 目录
mkdir -p e2e/screenshots/current
cp e2e/screenshots/visual/*.png e2e/screenshots/current/
```

### 步骤 3：对比差异

```bash
# 对比基线和当前截图
node tools/visual-compare.js e2e/screenshots/baseline e2e/screenshots/current e2e/screenshots/report
```

### 步骤 4：审核差异

```bash
# 查看对比报告
cat e2e/screenshots/report/REPORT.md
```

---

## AI 辅助差异检测

### 智能忽略规则

AI 可以帮助识别哪些差异是合理的，应该忽略：

```javascript
// AI 辅助的差异分类
const diffCategories = {
  // ✅ 合理变化 - 自动通过
  'acceptable': [
    '主题颜色变化（用户主动切换）',
    '字体大小调整（用户设置）',
    '响应式布局变化（视口改变）',
    '内容更新（日志条目增加）',
  ],
  
  // ⚠️ 需要审核 - 标记人工确认
  'needsReview': [
    '布局结构变化',
    '组件位置移动',
    '颜色意外变化',
    '元素缺失或新增',
  ],
  
  // ❌ 意外变化 - 测试失败
  'regression': [
    '按钮消失',
    '文本截断',
    '重叠元素',
    '布局崩溃',
  ],
};
```

### AI 提示词模板

```markdown
请分析以下 UI 截图差异，判断是否为合理的视觉变化：

**基线截图:** [baseline.png]
**当前截图:** [current.png]
**差异区域:** [diff.png]

**上下文信息:**
- 变更内容：[描述代码变更]
- 预期变化：[描述预期的视觉变化]
- 测试场景：[描述测试的功能]

**请判断:**
1. 差异是否合理？
2. 是否需要人工审核？
3. 是否应该更新基线？

**输出格式:**
```json
{
  "isAcceptable": true/false,
  "category": "acceptable|needsReview|regression",
  "reason": "判断理由",
  "shouldUpdateBaseline": true/false,
  "reviewNotes": "审核备注"
}
```
```

---

## 最佳实践

### 1. 稳定的选择器

```typescript
// ✅ 推荐 - 使用稳定的选择器
await page.getByRole('button', { name: '提交' }).screenshot();

// ❌ 避免 - 使用动态内容
await page.locator('.timestamp-12345').screenshot();
```

### 2. 隔离动态内容

```typescript
// 隐藏动态元素后再截图
await page.evaluate(() => {
  document.querySelector('.timestamp')?.setAttribute('data-visual-test-hidden', 'true');
});

await expect(page).toHaveScreenshot('homepage.png', {
  mask: [page.locator('[data-visual-test-hidden]')],
});
```

### 3. 固定的视口大小

```typescript
// 测试前统一设置视口
await page.setViewportSize({ width: 1920, height: 1080 });
await expect(page).toHaveScreenshot();
```

### 4. 等待动画完成

```typescript
// 等待动画完成
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000); // 等待 CSS 动画

// 或者禁用动画
await page.addStyleTag({
  content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }
  `,
});
```

### 5. 多主题测试

```typescript
// 测试不同主题
const themes = ['light', 'dark'];

for (const theme of themes) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  
  await expect(page).toHaveScreenshot(`homepage-${theme}.png`);
}
```

---

## CI/CD 集成

### GitHub Actions

```yaml
name: Visual Regression Tests

on:
  pull_request:
    branches: [ main, dev ]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0  # 获取完整历史用于对比
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install Playwright
      run: npx playwright install --with-deps chromium
    
    - name: Run visual tests
      run: npm run test:e2e -- visual-regression-v2.test.ts
    
    - name: Upload screenshots
      uses: actions/upload-artifact@v4
      with:
        name: screenshots
        path: e2e/screenshots/
    
    - name: Compare with baseline
      run: node tools/visual-compare.js baseline/ current/ report/
    
    - name: Upload report
      uses: actions/upload-artifact@v4
      with:
        name: visual-report
        path: report/
```

---

## 故障排查

### 问题 1：截图不一致

**原因:** 字体渲染、抗锯齿、时间戳等

**解决:**
```typescript
// 使用一致的字体渲染
await page.addStyleTag({
  content: '* { -webkit-font-smoothing: antialiased; }',
});

// 隐藏动态内容
await expect(page).toHaveScreenshot({
  mask: [page.locator('.timestamp, .live-data')],
});
```

### 问题 2：测试不稳定

**原因:** 网络延迟、动画未完成

**解决:**
```typescript
// 增加等待时间
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);

// 或者使用显式等待
await expect(page.locator('.loaded')).toBeVisible();
```

### 问题 3：差异太多

**原因:** 基线过期、大范围重构

**解决:**
```bash
# 更新基线
npm run test:e2e -- --update-snapshots

# 或者手动更新
rm -rf baseline/
cp -r current/ baseline/
```

---

## 进阶技巧

### 1. 组件级别截图

```typescript
// 只截图特定组件
const component = page.getByRole('navigation');
await component.screenshot({ path: 'navbar.png' });
```

### 2. 状态对比

```typescript
// 截图不同状态
await button.screenshot({ path: 'button-normal.png' });
await button.hover();
await button.screenshot({ path: 'button-hover.png' });
await button.click();
await button.screenshot({ path: 'button-active.png' });
```

### 3. 滚动截图

```typescript
// 全屏截图（包含滚动区域）
await page.screenshot({ 
  path: 'fullpage.png', 
  fullPage: true 
});
```

### 4. PDF 导出

```typescript
// 导出为 PDF（适合文档类页面）
await page.pdf({ 
  path: 'page.pdf', 
  printBackground: true 
});
```

---

## 参考资料

- [Playwright 视觉回归测试](https://playwright.dev/docs/test-snapshots)
- [Percy 官方文档](https://docs.percy.io)
- [Applitools 官方文档](https://applitools.com/docs)
- [像素级对比工具 pixelmatch](https://github.com/mapbox/pixelmatch)

---

**提示:** 视觉回归测试应该与其他测试结合使用，而不是替代功能测试！
