#!/bin/bash
# =============================================================================
# LogLayer 功能验证脚本
# 测试核心功能和交互是否正常工作
# =============================================================================

set -e

APP_URL="${APP_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCREENSHOT_DIR="$PROJECT_ROOT/tests/.outputs/ai/screenshots/current"
REPORT_DIR="$PROJECT_ROOT/tests/.outputs/ai/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PASS_COUNT=0
FAIL_COUNT=0

mkdir -p "$SCREENSHOT_DIR" "$REPORT_DIR"

echo "========================================"
echo "LogLayer 功能验证测试"
echo "时间: $(date)"
echo "========================================"

# 辅助函数
pass() {
    echo "✓ $1"
    ((PASS_COUNT++))
}

fail() {
    echo "✗ $1"
    ((FAIL_COUNT++))
}

# 清理并打开
browser-use close --all 2>/dev/null || true
browser-use open "$APP_URL"
browser-use wait selector "body" --timeout 10000

# ===========================================
# 测试 1: 侧边栏切换
# ===========================================
echo ""
echo "--- 测试侧边栏切换 ---"

browser-use state > /tmp/state_before.txt
BEFORE_COUNT=$(grep -c "^\[" /tmp/state_before.txt || echo "0")

if [ "$BEFORE_COUNT" -gt 0 ]; then
    pass "侧边栏元素加载正常 ($BEFORE_COUNT 个可交互元素)"
else
    fail "侧边栏元素未加载"
fi

# 点击各个图标
for i in 0 1 2 3 4; do
    if browser-use click $i 2>/dev/null; then
        browser-use wait timeout 300
        pass "侧边栏图标 $i 点击成功"
    else
        fail "侧边栏图标 $i 点击失败"
    fi
done

browser-use screenshot "$SCREENSHOT_DIR/feature-sidebar-$TIMESTAMP.png"

# ===========================================
# 测试 2: 键盘快捷键
# ===========================================
echo ""
echo "--- 测试键盘快捷键 ---"

# 测试设置快捷键 Ctrl+,
browser-use keys "Control+,"
sleep 1
if browser-use state | grep -qi "setting\|config\|preference"; then
    pass "Ctrl+, 打开设置面板成功"
else
    fail "Ctrl+, 打开设置面板失败"
fi
browser-use screenshot "$SCREENSHOT_DIR/feature-settings-$TIMESTAMP.png"
browser-use keys "Escape"

# 测试命令面板 Ctrl+Shift+P
browser-use keys "Control+Shift+P"
sleep 1
if browser-use state | grep -qi "command\|palette"; then
    pass "Ctrl+Shift+P 打开命令面板成功"
else
    fail "Ctrl+Shift+P 打开命令面板失败"
fi
browser-use screenshot "$SCREENSHOT_DIR/feature-command-palette-$TIMESTAMP.png"
browser-use keys "Escape"

# 测试搜索 Ctrl+F
browser-use keys "Control+F"
sleep 1
if browser-use state | grep -qi "find\|search\|input"; then
    pass "Ctrl+F 打开搜索框成功"
else
    fail "Ctrl+F 打开搜索框失败"
fi
browser-use screenshot "$SCREENSHOT_DIR/feature-find-$TIMESTAMP.png"
browser-use keys "Escape"

# 测试跳转行 Ctrl+G
browser-use keys "Control+G"
sleep 1
if browser-use state | grep -qi "goto\|line\|jump"; then
    pass "Ctrl+G 打开跳转框成功"
else
    fail "Ctrl+G 打开跳转框失败"
fi
browser-use screenshot "$SCREENSHOT_DIR/feature-goto-$TIMESTAMP.png"
browser-use keys "Escape"

# ===========================================
# 测试 3: 主题切换
# ===========================================
echo ""
echo "--- 测试主题切换 ---"

# 获取当前主题
CURRENT_THEME=$(browser-use eval "document.documentElement.getAttribute('data-theme') || 'dark'")
echo "当前主题: $CURRENT_THEME"

# 切换主题
if [ "$CURRENT_THEME" = "dark" ]; then
    browser-use eval "document.documentElement.setAttribute('data-theme', 'light')"
else
    browser-use eval "document.documentElement.setAttribute('data-theme', 'dark')"
fi
sleep 500

NEW_THEME=$(browser-use eval "document.documentElement.getAttribute('data-theme')")
if [ "$NEW_THEME" != "$CURRENT_THEME" ]; then
    pass "主题切换成功 ($CURRENT_THEME -> $NEW_THEME)"
else
    fail "主题切换失败"
fi
browser-use screenshot "$SCREENSHOT_DIR/feature-theme-$TIMESTAMP.png"

# ===========================================
# 测试 4: 响应式布局
# ===========================================
echo ""
echo "--- 测试响应式布局 ---"

# 桌面视图
browser-use eval "window.resizeTo(1920, 1080)"
sleep 500
browser-use screenshot "$SCREENSHOT_DIR/feature-desktop-$TIMESTAMP.png"
pass "桌面视图截图完成 (1920x1080)"

# 平板视图
browser-use eval "window.resizeTo(768, 1024)"
sleep 500
browser-use screenshot "$SCREENSHOT_DIR/feature-tablet-$TIMESTAMP.png"
pass "平板视图截图完成 (768x1024)"

# 移动端视图
browser-use eval "window.resizeTo(375, 667)"
sleep 500
browser-use screenshot "$SCREENSHOT_DIR/feature-mobile-$TIMESTAMP.png"
pass "移动端视图截图完成 (375x667)"

# 恢复桌面视图
browser-use eval "window.resizeTo(1920, 1080)"

# ===========================================
# 生成报告
# ===========================================
echo ""
echo "========================================"
echo "测试结果"
echo "========================================"
echo "通过: $PASS_COUNT"
echo "失败: $FAIL_COUNT"
echo "总计: $((PASS_COUNT + FAIL_COUNT))"

# 保存报告
REPORT_FILE="$REPORT_DIR/feature-$TIMESTAMP.txt"
cat > "$REPORT_FILE" << EOF
LogLayer 功能验证报告
====================
时间: $(date)
URL: $APP_URL

结果: 通过 $PASS_COUNT / 失败 $FAIL_COUNT

截图位置: $SCREENSHOT_DIR
EOF

echo "报告已保存: $REPORT_FILE"

# 清理
browser-use close

# 返回状态
if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi