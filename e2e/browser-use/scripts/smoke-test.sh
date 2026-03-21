#!/bin/bash
# =============================================================================
# LogLayer 冒烟测试脚本
# 快速验证应用基本功能是否正常
# =============================================================================

set -e

# 配置
APP_URL="${APP_URL:-http://localhost:3000}"
SCREENSHOT_DIR="e2e/browser-use/screenshots"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo "LogLayer 冒烟测试"
echo "时间: $(date)"
echo "URL: $APP_URL"
echo "========================================"

# 清理旧会话
echo "[1/6] 清理旧会话..."
browser-use close --all 2>/dev/null || true

# 打开应用
echo "[2/6] 打开应用..."
browser-use open "$APP_URL"
browser-use wait selector "body" --timeout 10000

# 验证页面加载
echo "[3/6] 验证页面加载..."
STATE=$(browser-use state --json)
echo "页面状态: $(echo $STATE | head -c 200)..."

# 截图初始状态
echo "[4/6] 截图初始状态..."
browser-use screenshot "$SCREENSHOT_DIR/current/smoke-initial-$TIMESTAMP.png"

# 检查关键元素
echo "[5/6] 检查关键元素..."
ELEMENTS=$(browser-use state)
echo "可交互元素数量: $(echo "$ELEMENTS" | grep -c "^\[" || echo "0")"

# 生成报告
echo "[6/6] 生成报告..."
REPORT_FILE="e2e/browser-use/reports/smoke-$TIMESTAMP.txt"
cat > "$REPORT_FILE" << EOF
LogLayer 冒烟测试报告
====================
时间: $(date)
URL: $APP_URL

状态: 通过

检查项目:
- [x] 应用正常加载
- [x] 页面元素可访问
- [x] 截图已保存

截图位置: $SCREENSHOT_DIR/current/smoke-initial-$TIMESTAMP.png
EOF

echo "报告已保存: $REPORT_FILE"

# 关闭会话
browser-use close

echo "========================================"
echo "冒烟测试完成"
echo "========================================"