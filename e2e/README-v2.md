# LogLayer E2E 测试系统 v2

> 统一 Playwright 自动化 + browser-use AI 探索 + 自然语言测试描述

---

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
npm install

# 安装 Playwright 浏览器
npx playwright install chromium

# 配置 AI 模型 (可选，用于 AI 探索测试)
export QWEN_URL="https://your-api-endpoint"
export QWEN_API_KEY="sk-your-key"
```

### 2. 运行测试

```bash
# 运行所有 Playwright 测试
npm run test:e2e

# 运行特定测试文件
npm run test:e2e -- --grep "图层管理"

# 运行视觉回归测试
npm run test:e2e:visual

# 运行 AI 探索测试
bash e2e/browser-use/scripts/ai-exploration.sh
```

---

## 测试架构

```
e2e/
├── test-scenarios/      # 自然语言测试场景 (YAML)
│   ├── smoke.yaml
│   ├── log-viewer.yaml
│   ├── layer-management.yaml
│   ├── workspace.yaml
│   └── keyboard-shortcuts.yaml
│
├── tests/               # Playwright 测试文件
│   ├── smoke.test.ts
│   └── ...
│
├── browser-use/         # AI 探索测试
│   ├── scripts/
│   └── README.md
│
├── pages/               # Page Objects
│   ├── LogLayerPage.ts
│   └── ...
│
├── selectors/           # 选择器字典
│   └── selectors.ts
│
├── utils/               # 测试工具
│   ├── test-helpers.ts
│   └── helpers.ts
│
└── runner/              # 场景运行器
    └── scenario-runner.ts
```

---

## 自然语言测试场景

### 场景格式 (YAML)

```yaml
name: 冒烟测试
description: 验证应用基本功能
priority: high
tags: [smoke, critical]

scenarios:
  - id: smoke-001
    name: 应用加载
    description: 用户打开应用
    steps:
      - action: goto
        params: { url: "/" }
      - action: expectVisible
        selector: "#root"
      - action: screenshot
        params: { name: "app-loaded.png" }
    expectedResult: 页面正常加载
```

### 可用操作

| 操作 | 参数 | 说明 |
|------|------|------|
| `goto` | `{ url: string }` | 导航到页面 |
| `waitForLoadState` | `{ state: string }` | 等待加载状态 |
| `expectVisible` | `selector` | 断言元素可见 |
| `expectHidden` | `selector` | 断言元素隐藏 |
| `click` | `selector, { index?: number }` | 点击元素 |
| `fill` | `selector, { value: string }` | 填充输入框 |
| `pressKey` | `{ key: string }` | 按下快捷键 |
| `screenshot` | `{ name: string }` | 截图 |
| `uploadFile` | `{ file: string }` | 上传文件 |
| `assert` | `{ condition: string }` | 条件断言 |

### 选择器路径

使用点号表示嵌套选择器:

```yaml
- action: expectVisible
  selector: "sidebar.container"
- action: click
  selector: "settings.tabs.appearance"
```

---

## 测试选择器字典

### 核心选择器

```typescript
// 侧边栏
sidebar.container    // '[aria-label="Sidebar"]'
sidebar.settings     // 设置按钮

// 日志查看器
logViewer.canvas     // 'canvas[role="log"]'
logViewer.container  // 日志容器

// 图层面板
layerPanel.container
layerPanel.addButton
layerPanel.layerItem

// 搜索
search.input
search.caseButton
search.regexButton

// 设置
settings.panel
settings.tabs.general
settings.tabs.appearance
```

### 快捷键

```typescript
keyboard.find           // 'Control+F'
keyboard.goToLine       // 'Control+G'
keyboard.settings       // 'Control+,'
keyboard.commandPalette // 'Control+Shift+P'
keyboard.escape         // 'Escape'
```

---

## AI 探索测试

### 运行 AI 探索

```bash
# 验证 AI 配置
bash e2e/browser-use/scripts/verify-qwen.sh

# 运行 AI 探索
bash e2e/browser-use/scripts/ai-exploration.sh
```

### AI 探索场景

AI Agent 会自动:
1. 打开应用并记录初始状态
2. 探索所有侧边栏功能
3. 测试键盘快捷键
4. 检查视觉布局
5. 生成问题报告

---

## 用自然语言描述测试

用户可以用自然语言描述测试场景，系统会自动转换为测试步骤:

```
用户输入:
"测试打开文件后状态栏显示正确的行数"

系统执行:
1. 解析意图
2. 生成测试步骤
3. 执行测试
4. 返回结果
```

---

## 测试报告

### 查看报告

```bash
# 打开 HTML 报告
npm run test:e2e:report

# 查看截图
ls e2e/screenshots/
```

### 报告内容

- 测试通过/失败统计
- 每个步骤的执行时间
- 失败步骤的错误信息
- 截图文件路径

---

## CI/CD 集成

测试自动在 CI 中运行:

```yaml
# .github/workflows/e2e-tests.yml
- name: Run E2E tests
  run: npm run test:e2e

- name: Run AI exploration
  run: bash e2e/browser-use/scripts/ai-exploration.sh
```

---

## 文件索引

| 文件 | 用途 |
|------|------|
| `ARCHITECTURE.md` | 测试系统架构设计 |
| `README.md` | 本文档 |
| `test-scenarios/*.yaml` | 自然语言测试场景 |
| `selectors/selectors.ts` | UI 选择器字典 |
| `utils/test-helpers.ts` | 测试工具函数 |
| `utils/helpers.ts` | 组件操作助手 |
| `runner/scenario-runner.ts` | 场景运行器 |
| `browser-use/README.md` | AI 测试文档 |

---

*创建日期: 2026-03-21*