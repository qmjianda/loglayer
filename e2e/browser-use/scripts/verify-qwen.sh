#!/bin/bash

echo "========================================"
echo "Qwen 模型配置测试"
echo "========================================"

if [ -z "$QWEN_API_KEY" ] || [ -z "$QWEN_URL" ]; then
    echo "ERROR: 请设置环境变量 QWEN_API_KEY 和 QWEN_URL"
    echo "示例: export QWEN_URL='https://your-api-endpoint'"
    echo "      export QWEN_API_KEY='sk-your-key'"
    exit 1
fi

export OPENAI_API_KEY="$QWEN_API_KEY"
export OPENAI_BASE_URL="$QWEN_URL"
export MODEL_NAME="${MODEL_NAME:-qwen3.5-plus}"

echo "API Key: ${QWEN_API_KEY:0:10}..."
echo "Base URL: $QWEN_URL"
echo "Model: $MODEL_NAME"
echo ""

python3 e2e/browser-use/scripts/test-qwen.py

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "配置验证成功！"
    echo ""
    echo "现在可以运行:"
    echo "  bash e2e/browser-use/scripts/ai-exploration.sh"
    echo "========================================"
else
    echo ""
    echo "配置验证失败，请检查 API Key 和网络连接"
fi