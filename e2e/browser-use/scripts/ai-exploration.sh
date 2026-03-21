#!/bin/bash

APP_URL="${APP_URL:-http://localhost:3000}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="e2e/browser-use/reports"

if [ -z "$QWEN_API_KEY" ] || [ -z "$QWEN_URL" ]; then
    echo "ERROR: 请设置环境变量 QWEN_API_KEY 和 QWEN_URL"
    echo "示例: export QWEN_URL='https://your-api-endpoint'"
    echo "      export QWEN_API_KEY='sk-your-key'"
    exit 1
fi

export OPENAI_API_KEY="$QWEN_API_KEY"
export OPENAI_BASE_URL="$QWEN_URL"
MODEL_NAME="${MODEL_NAME:-qwen3.5-plus}"

echo "========================================"
echo "LogLayer AI 探索测试"
echo "时间: $(date)"
echo "模型: $MODEL_NAME"
echo "========================================"

TASK_PROMPT='
你是 LogLayer 应用的 UI/UX 测试专家。请执行以下测试任务:

## 任务目标
1. 打开 LogLayer 应用
2. 全面探索应用的所有功能和界面
3. 记录发现的问题和改进建议

## 探索范围
1. 侧边栏功能: 点击每个侧边栏图标，记录每个面板的功能和布局
2. 键盘快捷键: Ctrl+F(搜索), Ctrl+G(跳转行), Ctrl+,(设置), Ctrl+Shift+P(命令面板)
3. 设置面板: 打开设置面板，检查各个选项卡
4. 视觉检查: 布局合理性、颜色对比度、字体清晰度、图标显示

## 输出格式
请以 JSON 格式输出结果:
{
  "summary": "测试总结",
  "features": ["功能列表"],
  "issues": [{"severity": "high|medium|low", "location": "位置", "description": "描述", "suggestion": "建议"}],
  "recommendations": ["改进建议"]
}
'

echo "启动 AI Agent 探索..."
browser-use run "$TASK_PROMPT" \
    --llm "$MODEL_NAME" \
    --max-steps 30 \
    --flash \
    > "$REPORT_DIR/ai-exploration-$TIMESTAMP.json" 2>&1

if [ -f "$REPORT_DIR/ai-exploration-$TIMESTAMP.json" ]; then
    echo ""
    echo "探索完成: $REPORT_DIR/ai-exploration-$TIMESTAMP.json"
    echo ""
    echo "=== 结果预览 ==="
    head -100 "$REPORT_DIR/ai-exploration-$TIMESTAMP.json"
else
    echo "探索失败"
fi

echo ""
echo "========================================"