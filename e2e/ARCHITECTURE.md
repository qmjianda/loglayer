# LogLayer E2E 测试系统架构 v2

> 统一 Playwright 自动化测试 + browser-use AI 探索测试 + 自然语言测试描述

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LogLayer 测试系统 v2                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     自然语言测试描述层 (Gherkin-like)                 │   │
│  │  test-scenarios/*.yaml  →  人类可读的测试场景定义                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       测试执行引擎层                                  │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │ Playwright Runner│  │ browser-use CLI │  │ 混合执行器      │     │   │
│  │  │ (自动化回归)      │  │ (AI 探索测试)   │  │ (场景驱动)      │     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Page Objects 层                                │   │
│  │  LogLayerPage │ SettingsPanel │ LayerPanel │ WorkspacePanel │ etc.  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       测试基础设施层                                  │   │
│  │  Fixtures │ Mocks │ Test Data │ Screenshot │ Reports                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
e2e/
├── config/                     # 测试配置
│   ├── playwright.config.ts    # Playwright 配置
│   ├── browser-use.config.ts   # browser-use 配置
│   └── test-data.config.ts     # 测试数据配置
│
├── test-scenarios/             # 自然语言测试场景 (YAML)
│   ├── smoke.yaml              # 冒烟测试场景
│   ├── log-viewer.yaml         # 日志查看器测试场景
│   ├── layer-management.yaml   # 图层管理测试场景
│   ├── workspace.yaml          # 工作区测试场景
│   └── ai-exploration.yaml     # AI 探索测试场景
│
├── tests/                      # Playwright 测试文件
│   ├── smoke.test.ts
│   ├── log-viewer.test.ts
│   ├── layer-management.test.ts
│   ├── workspace.test.ts
│   └── visual-regression.test.ts
│
├── browser-use/                # browser-use 测试
│   ├── scripts/
│   │   ├── ai-exploration.sh
│   │   ├── visual-capture.py
│   │   └── feature-check.sh
│   └── README.md
│
├── pages/                      # Page Objects
│   ├── index.ts
│   ├── LogLayerPage.ts
│   ├── SettingsPanel.ts
│   ├── LayerPanel.ts
│   ├── WorkspacePanel.ts
│   └── LogViewerPanel.ts
│
├── fixtures/                   # 测试 Fixtures
│   ├── index.ts
│   ├── test-data.ts            # 测试数据 fixtures
│   └── api-mocks.ts            # API mock fixtures
│
├── selectors/                  # 选择器字典
│   ├── index.ts
│   └── selectors.ts
│
├── utils/                      # 测试工具函数
│   ├── screenshot.ts
│   ├── wait-helpers.ts
│   └── assertions.ts
│
├── test-data/                  # 测试数据
│   ├── logs/
│   │   ├── small.log
│   │   ├── medium.log
│   │   └── large.log
│   └── fixtures/
│
├── screenshots/                # 测试截图
│   ├── baseline/
│   ├── current/
│   └── diff/
│
└── reports/                    # 测试报告
    └── *.html
```

---

## 自然语言测试场景格式

### 示例: test-scenarios/smoke.yaml

```yaml
name: 冒烟测试
description: 验证应用基本功能正常工作
priority: high
tags: [smoke, critical]

scenarios:
  - name: 应用加载
    description: 用户打开应用，验证基本 UI 元素可见
    steps:
      - action: 打开应用
        expected: 页面标题包含 LogLayer
      - action: 等待页面加载完成
        expected: 根元素可见
      - action: 截图
        file: smoke-app-loaded.png
    result: 通过时记录截图路径

  - name: 状态栏显示
    description: 验证状态栏正常显示
    steps:
      - action: 检查状态栏可见性
        expected: 状态栏可见
      - action: 获取状态栏文本
        expected: 文本非空
```

### 示例: test-scenarios/layer-management.yaml

```yaml
name: 图层管理测试
description: 测试图层增删改查和拖拽功能
priority: medium
tags: [layer, feature]

scenarios:
  - name: 添加图层
    description: 用户添加新的过滤图层
    steps:
      - action: 打开图层面板
      - action: 点击添加图层按钮
      - action: 选择图层类型
        type: FILTER
      - action: 验证图层已添加
        expected: 图层数量增加 1

  - name: 删除图层
    description: 用户删除已存在的图层
    steps:
      - action: 选择图层
        index: 0
      - action: 点击删除按钮
      - action: 确认删除
      - action: 验证图层已删除
        expected: 图层数量减少 1

  - name: 拖拽排序图层
    description: 用户拖拽图层改变顺序
    steps:
      - action: 拖拽图层
        from: 0
        to: 2
      - action: 验证顺序已改变
```

---

## 测试执行方式

### 1. Playwright 测试 (自动化回归)

```bash
# 运行所有测试
npm run test:e2e

# 运行特定场景
npm run test:e2e -- --grep "图层管理"

# 调试模式
npm run test:e2e:debug

# 视觉回归测试
npm run test:e2e:visual
```

### 2. browser-use 测试 (AI 探索)

```bash
# AI 探索测试
bash e2e/browser-use/scripts/ai-exploration.sh

# 视觉捕获
python e2e/browser-use/scripts/visual-capture.py
```

### 3. 场景驱动测试 (自然语言)

```bash
# 运行 YAML 场景
npx ts-node e2e/runner/scenario-runner.ts --file test-scenarios/smoke.yaml

# 交互式测试
npm run test:interactive
```

---

## Page Object 改进

### 增强的 LogLayerPage

```typescript
// pages/LogLayerPage.ts
export class LogLayerPage {
  readonly page: Page;
  readonly selectors: Selectors;
  
  // 核心元素
  readonly root: Locator;
  readonly sidebar: Locator;
  readonly statusBar: Locator;
  readonly tabBar: Locator;
  
  // 快捷操作
  async goto(): Promise<void>;
  async waitForLoaded(): Promise<void>;
  async screenshot(name: string): Promise<string>;
  
  // 自然语言支持
  async executeStep(step: TestStep): Promise<TestResult>;
  async verify(expected: ExpectedResult): Promise<boolean>;
}
```

---

## 选择器字典

```typescript
// selectors/selectors.ts
export const SELECTORS = {
  root: '#root',
  
  sidebar: {
    container: '[role="complementary"]',
    toggle: '[aria-label*="sidebar"]',
    icons: '.sidebar-icon',
  },
  
  logViewer: {
    canvas: 'canvas',
    container: '.log-viewer-container',
    gutter: '.line-gutter',
  },
  
  layerPanel: {
    container: '.layer-panel',
    layerList: '.layer-list',
    addButton: '[aria-label="Add layer"]',
  },
  
  statusBar: {
    container: '.status-bar',
    lineInfo: '.line-info',
    memory: '.memory-usage',
    cpu: '.cpu-usage',
  },
  
  settings: {
    panel: '.settings-panel',
    theme: '[name="theme"]',
    fontSize: '[name="fontSize"]',
  },
} as const;
```

---

## 测试结果报告

测试完成后生成结构化报告:

```json
{
  "scenario": "图层管理测试",
  "status": "passed",
  "duration": "12.5s",
  "steps": [
    {
      "action": "打开图层面板",
      "status": "passed",
      "screenshot": "screenshots/step-1.png"
    },
    {
      "action": "添加图层",
      "status": "passed",
      "details": "添加了 FILTER 类型图层"
    }
  ],
  "summary": "所有 3 个场景通过"
}
```

---

## 与自然语言的交互

用户可以用自然语言描述测试:

```
用户输入:
"测试一下打开文件后状态栏显示正确的行数"

系统执行:
1. 解析意图 → 打开文件 → 检查状态栏
2. 生成测试步骤
3. 执行测试
4. 返回结果

输出:
✅ 测试通过
- 打开文件: large_dummy.log
- 状态栏显示: "Ln 1, Col 1 / 10000 lines"
```

---

*创建日期: 2026-03-21*