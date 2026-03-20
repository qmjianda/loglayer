#!/usr/bin/env node

/**
 * AI 辅助 E2E 测试生成器
 * 
 * 使用 AI 根据页面结构或用户描述自动生成 Playwright 测试用例
 * 
 * 用法:
 *   node tools/generate-e2e-test.js <功能描述>
 *   node tools/generate-e2e-test.js --url http://localhost:5173
 *   node tools/generate-e2e-test.js --component Button
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 测试模板
const testTemplate = (description, testName) => `import { test, expect } from '@playwright/test';

/**
 * ${description}
 * 由 AI 辅助生成 - ${new Date().toISOString()}
 */

test.describe('${testName}', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('应该${description}', async ({ page }) => {
    // TODO: 根据实际 UI 调整选择器
    // 提示：使用 Playwright 的 Inspector 工具查找元素
    // 运行：npx playwright install && npx playwright codegen http://localhost:5173
    
    // 示例代码：
    // await page.click('button:has-text("提交")');
    // await expect(page.locator('.result')).toBeVisible();
    
    // 截图保存
    await page.screenshot({ path: 'e2e/screenshots/${testName.toLowerCase().replace(/\\s+/g, '-')}.png' });
  });
});
`;

// 命令行参数解析
const args = process.argv.slice(2);
const description = args.find(arg => !arg.startsWith('--')) || '新功能测试';
const testName = description.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50);

// 生成测试文件
const testContent = testTemplate(description, testName);
const testPath = join(__dirname, '../e2e', `${testName}.test.ts`);

// 确保目录存在
const screenshotsDir = join(__dirname, '../e2e/screenshots');
if (!existsSync(screenshotsDir)) {
  mkdirSync(screenshotsDir, { recursive: true });
}

// 写入文件
writeFileSync(testPath, testContent);

console.log(`✅ 测试文件已生成：${testPath}`);
console.log(`\n下一步:`);
console.log(`1. 编辑 ${testPath} 完善测试逻辑`);
console.log(`2. 运行测试：npm run test:e2e -- --grep "${testName}"`);
console.log(`3. 使用 UI 模式调试：npm run test:e2e:ui`);
console.log(`\n提示：使用 Playwright Codegen 录制操作:`);
console.log(`   npx playwright codegen http://localhost:5173`);
