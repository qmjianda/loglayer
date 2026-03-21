# LogLayer UI/UX 测试方案 (browser-use)

> 基于 AI Agent 的智能 UI/UX 测试框架

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                    browser-use 测试架构                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  本地开发服务器 │◄──│ Cloudflare   │◄──│ 远程浏览器    │      │
│  │  localhost:3000 │  │ Tunnel       │    │ (remote)     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │              │
│         ▼                   ▼                   ▼              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    测试执行层                              │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │  │
│  │  │探索测试  │  │回归测试  │  │视觉测试  │  │性能测试  │     │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                   │                   │              │
│         ▼                   ▼                   ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ AI Agent     │    │ Python 脚本  │    │ 截图/报告    │      │
│  │ 自主探索     │    │ 自动化测试   │    │ 结果存档     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 与 Playwright 对比

| 维度 | Playwright | browser-use |
|------|-----------|-------------|
| **测试模式** | 预定义测试脚本 | AI Agent + 脚本混合 |
| **浏览器管理** | 自动启动/关闭 | 持久会话，手动控制 |
| **断言方式** | 严格代码断言 | 视觉验证 + AI 判断 |
| **探索能力** | 无 | AI 自主探索 UI |
| **适用场景** | CI/CD 自动化回归 | 探索性测试、交互调试 |
| **学习曲线** | 中等 | 低（自然语言描述） |

### 推荐使用场景

**使用 browser-use**:
- 探索新功能的 UI 行为
- 快速验证设计变更
- 复杂交互流程测试
- 需要视觉验证的场景
- 本地开发调试

**使用 Playwright**:
- CI/CD 自动化回归
- 严格的断言验证
- 性能基准测试
- 多浏览器兼容性

---

## 快速开始

### 1. 环境检查

```bash
# 检查 browser-use 环境
browser-use doctor

# 预期输出:
# ✅ browser-use CLI installed
# ✅ Chromium available
# ✅ cloudflared installed (for tunnel)
```

### 2. 启动测试服务器

```bash
# 终端 1: 启动前端开发服务器
npm run dev

# 终端 2: 启动后端
python backend/main.py
```

### 3. 基础测试命令

```bash
# 方式 A: 本地测试（推荐开发时使用）
browser-use --browser chromium --headed open http://localhost:3000
browser-use state
browser-use screenshot e2e/browser-use/screenshots/homepage.png

# 方式 B: 远程测试（CI/CD 或需要外部访问时）
browser-use tunnel 3000
# 输出: https://xxx.trycloudflare.com
browser-use --browser remote open https://xxx.trycloudflare.com
```

---

## 测试场景

### 场景 1: 探索性测试 (AI Agent)

**目标**: 让 AI 自主探索 UI，发现潜在问题

```bash
# 启动 AI Agent 探索
browser-use -b remote run "打开 LogLayer 应用，探索所有侧边栏功能，点击每个图标并记录看到的内容。检查是否有任何 UI 异常或布局问题。最后提供一个完整的功能清单和发现的问题。"
```

**预期输出**:
- 完整的功能清单
- 发现的 UI 问题
- 建议的改进

### 场景 2: 核心功能回归

**目标**: 验证核心功能正常工作

```bash
# 步骤化测试
# 1. 打开应用
browser-use open http://localhost:3000

# 2. 检查初始状态
browser-use state

# 3. 验证侧边栏
browser-use click 1  # 点击工作区图标
browser-use screenshot e2e/browser-use/screenshots/workspace-panel.png

browser-use click 2  # 点击搜索图标
browser-use screenshot e2e/browser-use/screenshots/search-panel.png

browser-use click 3  # 点击统计图标
browser-use screenshot e2e/browser-use/screenshots/stats-panel.png
```

### 场景 3: 视觉回归测试

**目标**: 捕获 UI 快照用于视觉对比

```bash
# 使用 Python 脚本进行批量截图
browser-use python --file e2e/browser-use/scripts/visual-capture.py
```

### 场景 4: 性能测试

**目标**: 测量页面加载和交互性能

```bash
# 使用 JavaScript 测量性能
browser-use eval "
const timing = performance.timing;
JSON.stringify({
  domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
  loadComplete: timing.loadEventEnd - timing.navigationStart,
  domReady: timing.domComplete - timing.domInteractive
});
"
```

### 场景 5: 可访问性测试

**目标**: 检查键盘导航和 ARIA 支持

```bash
# 键盘导航测试
browser-use keys "Tab"
browser-use state  # 检查焦点元素
browser-use keys "Tab"
browser-use state
browser-use keys "Enter"
browser-use screenshot e2e/browser-use/screenshots/keyboard-nav.png
```

---

## 测试脚本模板

### 模板 1: 基础冒烟测试

```bash
#!/bin/bash
# e2e/browser-use/scripts/smoke-test.sh

set -e

echo "=== LogLayer 冒烟测试 ==="

# 1. 打开应用
echo "1. 打开应用..."
browser-use open http://localhost:3000
browser-use wait selector "body"

# 2. 验证主要组件
echo "2. 验证主要组件..."
browser-use state

# 3. 截图
echo "3. 保存截图..."
browser-use screenshot e2e/browser-use/screenshots/smoke-test.png

# 4. 关闭
browser-use close

echo "=== 冒烟测试完成 ==="
```

### 模板 2: 视觉捕获脚本 (Python)

```python
# e2e/browser-use/scripts/visual-capture.py

screenshots = [
    ("workspace", "点击工作区图标"),
    ("search", "点击搜索图标"),
    ("stats", "点击统计图标"),
    ("ai", "点击AI助手图标"),
    ("settings", "点击设置图标"),
]

base_path = "e2e/browser-use/screenshots"

# 遍历并截图
for i, (name, _) in enumerate(screenshots):
    # 点击对应索引的侧边栏图标
    browser.click(i + 1)  # 假设索引从1开始
    browser.wait(500)
    
    # 截图
    browser.screenshot(f"{base_path}/{name}.png")
    print(f"Captured: {name}.png")

print("All screenshots captured!")
```

### 模板 3: 功能验证脚本

```bash
#!/bin/bash
# e2e/browser-use/scripts/feature-check.sh

echo "=== 功能验证测试 ==="

# 打开应用
browser-use open http://localhost:3000

# 测试 1: 侧边栏切换
echo "测试侧边栏切换..."
for i in 1 2 3 4 5; do
    browser-use click $i
    browser-use wait selector ".sidebar-panel" --timeout 2000
done

# 测试 2: 设置面板
echo "测试设置面板..."
browser-use keys "Control+,"
browser-use wait selector ".settings-panel" --timeout 3000
browser-use screenshot e2e/browser-use/screenshots/settings-open.png

# 测试 3: 命令面板
echo "测试命令面板..."
browser-use keys "Escape"
browser-use keys "Control+Shift+P"
browser-use wait selector ".command-palette" --timeout 3000
browser-use screenshot e2e/browser-use/screenshots/command-palette.png

# 测试 4: 搜索框
echo "测试搜索框..."
browser-use keys "Escape"
browser-use keys "Control+F"
browser-use wait selector ".find-widget" --timeout 3000
browser-use screenshot e2e/browser-use/screenshots/find-widget.png

# 关闭
browser-use close

echo "=== 功能验证完成 ==="
```

---

## AI Agent 测试

### 自主探索测试

```bash
# 让 AI 自主探索 LogLayer 的所有功能
browser-use -b remote run "
你是 LogLayer 的 UI/UX 测试专家。请完成以下任务:

1. 打开应用并记录初始状态
2. 逐一点击左侧图标栏的每个图标，记录每个面板的功能
3. 测试键盘快捷键:
   - Ctrl+F: 搜索
   - Ctrl+G: 跳转行
   - Ctrl+,: 设置
   - Ctrl+Shift+P: 命令面板
4. 检查每个面板的布局和交互是否正常
5. 记录发现的任何 UI 问题或改进建议

最后输出:
- 功能清单
- 问题列表
- 改进建议
" --flash
```

### 并行探索测试

```bash
# 同时探索多个功能模块
browser-use -b remote run "探索侧边栏所有面板的功能和布局" &
browser-use -b remote run "测试所有键盘快捷键是否正常工作" &
browser-use -b remote run "检查设置面板的各个选项卡" &

wait
echo "所有探索任务完成"
```

---

## 截图管理

### 目录结构

```
e2e/browser-use/
├── screenshots/
│   ├── baseline/       # 基准截图
│   ├── current/        # 当前截图
│   └── diff/           # 对比差异
├── scripts/
│   ├── smoke-test.sh
│   ├── visual-capture.py
│   └── feature-check.sh
└── reports/
    └── *.html          # 测试报告
```

### 截图对比

```bash
# 捕获当前截图
browser-use screenshot e2e/browser-use/screenshots/current/homepage.png

# 对比基准截图（需要安装像素对比工具）
npx pixelmatch \
  e2e/browser-use/screenshots/baseline/homepage.png \
  e2e/browser-use/screenshots/current/homepage.png \
  e2e/browser-use/screenshots/diff/homepage.png
```

---

## CI/CD 集成

### GitHub Actions 配置

```yaml
# .github/workflows/browser-use-tests.yml
name: Browser-Use UI Tests

on:
  workflow_dispatch:  # 手动触发
  pull_request:
    paths:
      - 'frontend/src/**'

jobs:
  ui-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install browser-use
        run: pip install browser-use
      
      - name: Start dev server
        run: npm run dev &
      
      - name: Wait for server
        run: npx wait-on http://localhost:3000 -t 60000
      
      - name: Run smoke tests
        run: bash e2e/browser-use/scripts/smoke-test.sh
      
      - name: Run AI exploration
        run: |
          browser-use -b remote run "探索 LogLayer 应用并报告任何 UI 问题" \
            --structured-output '{"type":"object","properties":{"issues":{"type":"array"},"summary":{"type":"string"}}}'
      
      - name: Upload screenshots
        uses: actions/upload-artifact@v4
        with:
          name: browser-use-screenshots
          path: e2e/browser-use/screenshots/
```

---

## 最佳实践

### 1. 测试隔离

每个测试脚本应该:
- 打开新的浏览器会话
- 测试完成后关闭会话
- 不依赖其他测试的状态

```bash
# 推荐
browser-use --session test-1 open http://localhost:3000
browser-use --session test-1 screenshot ...
browser-use --session test-1 close

browser-use --session test-2 open http://localhost:3000
# ...
```

### 2. 等待策略

优先使用显式等待:

```bash
# 推荐: 等待特定元素
browser-use wait selector ".layer-list"

# 避免: 固定等待时间
browser-use eval "setTimeout(() => {}, 2000)"  # 不推荐
```

### 3. 错误处理

脚本中添加错误检查:

```bash
#!/bin/bash
set -e  # 遇错即停

# 检查浏览器状态
if ! browser-use state; then
    echo "Browser not responding"
    exit 1
fi
```

### 4. 截图命名规范

```
{功能模块}_{操作}_{状态}.png

示例:
- workspace_panel_open.png
- settings_theme_switched.png
- search_results_loaded.png
```

---

## 常用命令速查

```bash
# 启动/关闭
browser-use open <url>              # 打开页面
browser-use close                   # 关闭当前会话
browser-use close --all             # 关闭所有会话

# 状态检查
browser-use state                   # 获取页面状态
browser-use screenshot <path>       # 截图
browser-use eval "JS代码"           # 执行 JS

# 交互
browser-use click <index>           # 点击元素
browser-use input <index> "文本"    # 输入文本
browser-use keys "快捷键"           # 发送按键
browser-use scroll down             # 滚动

# 等待
browser-use wait selector "选择器"  # 等待元素
browser-use wait text "文本"        # 等待文本

# AI Agent
browser-use -b remote run "任务"    # AI 执行任务
browser-use task status <id>        # 检查任务状态
browser-use task list               # 列出任务

# Tunnel
browser-use tunnel <port>           # 创建隧道
browser-use tunnel list             # 列出隧道
browser-use tunnel stop --all       # 停止所有隧道
```

---

## 测试检查清单

### 基础功能

- [ ] 应用正常加载
- [ ] 侧边栏图标可点击
- [ ] 面板切换正常
- [ ] 状态栏显示正确

### 键盘快捷键

- [ ] Ctrl+F: 搜索框
- [ ] Ctrl+G: 跳转行
- [ ] Ctrl+,: 设置面板
- [ ] Ctrl+Shift+P: 命令面板
- [ ] Esc: 关闭弹窗

### 视觉检查

- [ ] 暗色主题正常
- [ ] 亮色主题正常
- [ ] 响应式布局（移动端/平板）
- [ ] 图标显示正确
- [ ] 字体渲染清晰

### 交互检查

- [ ] 按钮悬停效果
- [ ] 输入框聚焦样式
- [ ] 滚动流畅
- [ ] 动画过渡平滑

---

## Qwen 模型配置

测试脚本支持通过环境变量配置 LLM API。

### 配置方式

在 `~/.bashrc` 中添加环境变量：

```bash
export QWEN_URL="https://your-api-endpoint"
export QWEN_API_KEY="sk-your-api-key"
```

然后重新加载：

```bash
source ~/.bashrc
```

### 验证配置

```bash
bash e2e/browser-use/scripts/verify-qwen.sh
```

### 运行测试

```bash
# 使用默认模型 (qwen3.5-plus)
bash e2e/browser-use/scripts/ai-exploration.sh

# 指定其他模型
MODEL_NAME=qwen-max bash e2e/browser-use/scripts/ai-exploration.sh
```

---

## 扩展阅读

- [browser-use CLI 文档](https://github.com/browser-use/browser-use/blob/main/browser_use/skill_cli/README.md)
- [阿里云灵积 API 文档](https://help.aliyun.com/document_detail/2712195.html)
- [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Playwright 对比指南](./README.md)

---

*创建日期: 2026-03-21*