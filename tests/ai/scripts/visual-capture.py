#!/usr/bin/env python3
"""
LogLayer 视觉捕获脚本
批量捕获 UI 组件截图用于视觉回归测试
"""

import json
import os
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
SCREENSHOT_DIR = PROJECT_ROOT / "tests" / ".outputs" / "ai" / "screenshots"
CURRENT_DIR = SCREENSHOT_DIR / "current"
BASELINE_DIR = SCREENSHOT_DIR / "baseline"

# 测试场景定义
TEST_SCENARIOS = [
    {
        "name": "homepage",
        "description": "首页初始状态",
        "actions": [],
    },
    {
        "name": "workspace-panel",
        "description": "工作区面板",
        "actions": [
            {"type": "click", "index": 0},  # 第一个侧边栏图标
        ],
    },
    {
        "name": "search-panel",
        "description": "搜索面板",
        "actions": [
            {"type": "click", "index": 1},
        ],
    },
    {
        "name": "stats-panel",
        "description": "统计面板",
        "actions": [
            {"type": "click", "index": 2},
        ],
    },
    {
        "name": "ai-panel",
        "description": "AI 助手面板",
        "actions": [
            {"type": "click", "index": 3},
        ],
    },
    {
        "name": "settings-panel",
        "description": "设置面板",
        "actions": [
            {"type": "keys", "value": "Control+,"},
        ],
    },
    {
        "name": "command-palette",
        "description": "命令面板",
        "actions": [
            {"type": "keys", "value": "Escape"},
            {"type": "keys", "value": "Control+Shift+P"},
        ],
    },
    {
        "name": "find-widget",
        "description": "搜索框",
        "actions": [
            {"type": "keys", "value": "Escape"},
            {"type": "keys", "value": "Control+F"},
        ],
    },
    {
        "name": "go-to-line",
        "description": "跳转行框",
        "actions": [
            {"type": "keys", "value": "Escape"},
            {"type": "keys", "value": "Control+G"},
        ],
    },
]


def run_visual_capture():
    """执行视觉捕获"""
    print("=" * 50)
    print("LogLayer 视觉捕获")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    # 确保目录存在
    os.makedirs(CURRENT_DIR, exist_ok=True)

    results = []

    for scenario in TEST_SCENARIOS:
        name = scenario["name"]
        print(f"\n捕获: {name} - {scenario['description']}")

        # 执行操作
        for action in scenario.get("actions", []):
            if action["type"] == "click":
                browser.click(action["index"])
                browser.wait(300)
            elif action["type"] == "keys":
                browser.keys(action["value"])
                browser.wait(500)

        # 截图
        screenshot_path = os.path.join(CURRENT_DIR, f"{name}.png")
        browser.screenshot(screenshot_path)

        print(f"  ✓ 已保存: {screenshot_path}")
        results.append({"name": name, "path": screenshot_path, "status": "success"})

    # 输出报告
    print("\n" + "=" * 50)
    print("捕获完成")
    print(f"总计: {len(results)} 个截图")
    print(f"位置: {CURRENT_DIR}")
    print("=" * 50)

    return results


# 主入口
if __name__ == "__main__":
    run_visual_capture()
