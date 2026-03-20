#!/usr/bin/env node

/**
 * AI 辅助 E2E 测试生成器 v2
 * 
 * 功能：
 * - 根据组件名称生成测试
 * - 根据页面 URL 生成测试
 * - 根据自然语言描述生成测试
 * - 自动生成 Page Object
 * 
 * 用法:
 *   node tools/ai-test-generator.js --component Button
 *   node tools/ai-test-generator.js --url http://localhost:5173
 *   node tools/ai-test-generator.js --desc "测试用户登录流程"
 *   node tools/ai-test-generator.js --page-object LogLayerPage
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 测试模板库
const templates = {
  // 组件测试模板
  component: (componentName, description) => `import { test, expect } from '../fixtures';

/**
 * ${componentName} 组件测试
 * ${description}
 * 
 * 由 AI 辅助生成 - ${new Date().toISOString()}
 */

test.describe('${componentName} 组件', () => {
  test.beforeEach(async ({ logLayer }) => {
    await logLayer.goto();
    await logLayer.waitForLoaded();
  });

  test('应该渲染${componentName}组件', async ({ page }) => {
    // TODO: 根据实际组件调整选择器
    const component = page.getByRole('button', { name: '${componentName}' })
                        .or(page.locator('.${componentName.toLowerCase()}, [data-testid="${componentName.toLowerCase()}"]'));
    
    await expect(component.first()).toBeVisible();
  });

  test('应该响应${componentName}点击事件', async ({ page }) => {
    const component = page.getByRole('button', { name: '${componentName}' })
                          .or(page.locator('.${componentName.toLowerCase()}'));
    
    const count = await component.count();
    if (count > 0) {
      await component.first().click();
      await page.waitForTimeout(300);
      
      // TODO: 添加验证逻辑
      // await expect(某个元素).toBeVisible();
    }
  });

  test('应该处理${componentName}的禁用状态', async ({ page }) => {
    const component = page.getByRole('button', { name: '${componentName}' })
                          .or(page.locator('.${componentName.toLowerCase()}'));
    
    const count = await component.count();
    if (count > 0) {
      // 检查是否有禁用状态
      const disabled = await component.first().isDisabled();
      console.log('${componentName} disabled state:', disabled);
    }
  });
});
`,

  // 功能测试模板
  feature: (featureName, description) => `import { test, expect } from '../fixtures';

/**
 * ${featureName}功能测试
 * ${description}
 * 
 * 由 AI 辅助生成 - ${new Date().toISOString()}
 */

test.describe('${featureName}功能', () => {
  test.beforeEach(async ({ logLayer }) => {
    await logLayer.goto();
    await logLayer.waitForLoaded();
  });

  test('应该能够${featureName}', async ({ logLayer, page }) => {
    // TODO: 实现${featureName}的测试逻辑
    
    // 示例：
    // 1. 找到相关元素
    // const element = page.getByRole('button', { name: '${featureName}' });
    
    // 2. 执行操作
    // await element.click();
    
    // 3. 验证结果
    // await expect(某个元素).toBeVisible();
    
    await logLayer.screenshot('${featureName.toLowerCase().replace(/\\s+/g, '-')}.png');
  });

  test('应该处理${featureName}的边界情况', async ({ page }) => {
    // TODO: 测试边界情况
    // - 空输入
    // - 超长输入
    // - 快速连续操作
    // - 网络延迟
  });

  test('应该处理${featureName}的错误情况', async ({ page }) => {
    // TODO: 测试错误处理
    // - 无效输入
    // - 网络错误
    // - 权限不足
  });
});
`,

  // Page Object 模板
  pageObject: (className) => `import { Page, Locator } from '@playwright/test';

/**
 * ${className} Page Object
 * 
 * 由 AI 辅助生成 - ${new Date().toISOString()}
 * 
 * 使用说明：
 * 1. 根据实际 UI 元素完善选择器
 * 2. 添加常用操作方法
 * 3. 在 fixtures.ts 中注册
 */

export class ${className} {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('#root');
    
    // TODO: 根据实际 UI 添加更多选择器
    // 示例：
    // this.submitButton = page.getByRole('button', { name: '提交' });
    // this.input = page.getByLabel('用户名');
  }

  /**
   * 导航到页面
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 等待页面加载
   */
  async waitForLoaded() {
    await this.root.waitFor({ state: 'visible' });
  }

  // TODO: 添加更多操作方法
  // 示例：
  // async submit() {
  //   await this.submitButton.click();
  // }
}
`,

  // 完整测试模板（带注释）
  full: (testName, description, steps) => `import { test, expect } from '../fixtures';

/**
 * ${testName}
 * 
 * 描述：${description}
 * 
 * 测试步骤：
${steps.map((step, i) => ` * ${i + 1}. ${step}`).join('\\n')}
 * 
 * 由 AI 辅助生成 - ${new Date().toISOString()}
 */

test.describe('${testName}', () => {
  test.beforeEach(async ({ logLayer }) => {
    await logLayer.goto();
    await logLayer.waitForLoaded();
  });

  test('主流程测试', async ({ logLayer, page }) => {
    // 步骤 1: 准备测试数据
    // TODO: 实现准备逻辑

    // 步骤 2: 执行操作
    // TODO: 实现操作逻辑

    // 步骤 3: 验证结果
    // TODO: 实现验证逻辑

    // 截图保存
    await logLayer.screenshot('${testName.toLowerCase().replace(/\\s+/g, '-')}.png');
  });

  test('边界情况测试', async ({ page }) => {
    // 测试空输入
    // 测试超长输入
    // 测试特殊字符
    // 测试快速连续操作
  });

  test('错误处理测试', async ({ page }) => {
    // 测试无效输入
    // 测试网络错误
    // 测试权限不足
  });
});
`,
};

// 命令行参数解析
const args = process.argv.slice(2);
const argMap = {};
let positionalArgs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    argMap[key] = value;
  } else {
    positionalArgs.push(args[i]);
  }
}

// 确保目录存在
const e2eDir = join(__dirname, '../e2e');
const pagesDir = join(e2eDir, 'pages');
const screenshotsDir = join(e2eDir, 'screenshots');

[ e2eDir, pagesDir, screenshotsDir ].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// 生成测试
let output = '';
let outputPath = '';

if (argMap.component) {
  // 生成组件测试
  const componentName = argMap.component;
  output = templates.component(componentName, `测试${componentName}组件的渲染和交互`);
  outputPath = join(e2eDir, `${componentName.toLowerCase()}.test.ts`);
} else if (argMap.feature || argMap.desc) {
  // 生成功能测试
  const featureName = argMap.feature || argMap.desc;
  output = templates.feature(featureName, `测试${featureName}功能`);
  outputPath = join(e2eDir, `${featureName.toLowerCase().replace(/\\s+/g, '-')}.test.ts`);
} else if (argMap['page-object']) {
  // 生成 Page Object
  const className = argMap['page-object'];
  output = templates.pageObject(className);
  outputPath = join(pagesDir, `${className}.ts`);
} else if (positionalArgs.length > 0) {
  // 使用默认模板
  const description = positionalArgs.join(' ');
  const testName = description.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '-');
  output = templates.feature(testName, description);
  outputPath = join(e2eDir, `${testName}.test.ts`);
} else {
  // 显示帮助
  console.log(`
🤖 AI 辅助 E2E 测试生成器

用法:
  node tools/ai-test-generator.js --component <组件名>
  node tools/ai-test-generator.js --feature <功能名>
  node tools/ai-test-generator.js --desc "<功能描述>"
  node tools/ai-test-generator.js --page-object <类名>
  node tools/ai-test-generator.js "<自然语言描述>"

示例:
  node tools/ai-test-generator.js --component Button
  node tools/ai-test-generator.js --feature 用户登录
  node tools/ai-test-generator.js --desc "测试文件上传和解析功能"
  node tools/ai-test-generator.js --page-object SearchPanel
  node tools/ai-test-generator.js "测试搜索功能，支持关键词和正则表达式"

选项:
  --component     生成组件测试
  --feature       生成功能测试
  --desc          根据描述生成测试
  --page-object   生成 Page Object 类
  --help          显示帮助

`);
  process.exit(0);
}

// 写入文件
writeFileSync(outputPath, output);

console.log(`✅ 测试文件已生成：${outputPath}`);
console.log(`\n下一步:`);
console.log(`1. 编辑 ${outputPath} 完善测试逻辑`);
console.log(`2. 运行测试：npm run test:e2e -- ${outputPath.split('/').pop()}`);
console.log(`3. 使用 UI 模式调试：npm run test:e2e:ui`);
console.log(`\n提示：`);
console.log(`- 使用 Playwright Inspector: PWDEBUG=1 npm run test:e2e`);
console.log(`- 使用 Codegen 录制：npx playwright codegen http://localhost:5173`);
