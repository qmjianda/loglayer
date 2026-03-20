#!/usr/bin/env node

/**
 * 视觉回归对比工具
 * 
 * 功能：
 * - 对比两次测试的截图差异
 * - 生成差异报告
 * - 标记需要人工审核的差异
 * 
 * 用法:
 *   node tools/visual-compare.js baseline/ current/
 *   node tools/visual-compare.js --help
 */

import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 简单的图片哈希对比（实际项目中建议使用 pixelmatch 或 similar）
function hashFile(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function compareDirectories(baselineDir, currentDir, outputDir) {
  const results = {
    identical: [],
    different: [],
    new: [],
    removed: [],
    timestamp: new Date().toISOString(),
  };

  // 确保输出目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 获取基线目录文件
  const baselineFiles = existsSync(baselineDir) 
    ? readdirSync(baselineDir).filter(f => f.endsWith('.png'))
    : [];
  
  // 获取当前目录文件
  const currentFiles = existsSync(currentDir)
    ? readdirSync(currentDir).filter(f => f.endsWith('.png'))
    : [];

  // 对比文件
  for (const file of currentFiles) {
    const baselinePath = join(baselineDir, file);
    const currentPath = join(currentDir, file);
    
    if (!existsSync(baselinePath)) {
      results.new.push(file);
      continue;
    }

    const baselineHash = hashFile(baselinePath);
    const currentHash = hashFile(currentPath);

    if (baselineHash === currentHash) {
      results.identical.push(file);
    } else {
      results.different.push({
        file,
        baselineHash,
        currentHash,
        needsReview: true,
      });
    }
  }

  // 检查删除的文件
  for (const file of baselineFiles) {
    if (!currentFiles.includes(file)) {
      results.removed.push(file);
    }
  }

  return results;
}

function generateReport(results, outputPath) {
  const report = `
# 视觉回归对比报告

**生成时间:** ${results.timestamp}

## 摘要

| 状态 | 数量 |
|------|------|
| ✅ 相同 | ${results.identical.length} |
| ⚠️ 不同 | ${results.different.length} |
| 🆕 新增 | ${results.new.length} |
| ❌ 删除 | ${results.removed.length} |
| **总计** | ${results.identical.length + results.different.length + results.new.length} |

## 相同的文件

${results.identical.length > 0 
  ? results.identical.map(f => `- ✅ ${f}`).join('\n')
  : '_无_'
}

## 不同的文件（需要审核）

${results.different.length > 0
  ? results.different.map(d => `
### ${d.file}

- **基线哈希:** \`${d.baselineHash.substring(0, 16)}...\`
- **当前哈希:** \`${d.currentHash.substring(0, 16)}...\`
- **状态:** ⚠️ 需要人工审核

![差异](../current/${d.file})
`).join('\n')
  : '_无_'
}

## 新增的文件

${results.new.length > 0
  ? results.new.map(f => `- 🆕 ${f}`).join('\n')
  : '_无_'
}

## 删除的文件

${results.removed.length > 0
  ? results.removed.map(f => `- ❌ ${f}`).join('\n')
  : '_无_'
}

---

*报告由 AI 视觉对比工具生成*
`;

  writeFileSync(outputPath, report);
  return report;
}

// 命令行参数解析
const args = process.argv.slice(2);

if (args.includes('--help') || args.length < 2) {
  console.log(`
🔍 视觉回归对比工具

用法:
  node tools/visual-compare.js <baseline-dir> <current-dir> [output-dir]

示例:
  node tools/visual-compare.js e2e/screenshots/baseline e2e/screenshots/current
  node tools/visual-compare.js baseline/ current/ reports/

参数:
  baseline-dir   基线截图目录
  current-dir    当前截图目录
  output-dir     输出报告目录（可选，默认：visual-compare-report）

输出:
  - visual-compare-report/REPORT.md  对比报告
  - visual-compare-report/diffs/     差异标记文件

`);
  process.exit(args.includes('--help') ? 0 : 1);
}

const [ baselineDir, currentDir, outputDir = 'visual-compare-report' ] = args;

console.log('🔍 开始视觉对比...');
console.log(`基线目录：${baselineDir}`);
console.log(`当前目录：${currentDir}`);
console.log(`输出目录：${outputDir}`);

try {
  const results = compareDirectories(baselineDir, currentDir, outputDir);
  const reportPath = join(outputDir, 'REPORT.md');
  
  generateReport(results, reportPath);
  
  console.log('\n✅ 对比完成！');
  console.log(`\n结果摘要:`);
  console.log(`  ✅ 相同：${results.identical.length}`);
  console.log(`  ⚠️  不同：${results.different.length}`);
  console.log(`  🆕  新增：${results.new.length}`);
  console.log(`  ❌  删除：${results.removed.length}`);
  console.log(`\n📄 报告已生成：${reportPath}`);
  
  if (results.different.length > 0) {
    console.log(`\n⚠️  发现 ${results.different.length} 个差异，需要人工审核！`);
  }
} catch (error) {
  console.error('❌ 对比失败:', error.message);
  process.exit(1);
}
