"""
IT（e2e）回归：分屏切换 tab 时，各面板滚动位置必须保持，不得跳回首行。

背景 Bug：dockview 激活/失活面板（切换 dv-active-group/dv-inactive-group class）时，
浏览器会把该面板内容（LogViewer 滚动容器）的 DOM scrollTop 归零，且不触发 scroll 事件，
React state 仍是旧值 —— 表现为"切 tab 后进度跳回首行"。
修复：LogViewer 滚动位置看门狗逐帧检测「DOM=0 但 state>0 且近期无用户滚动」，同帧拉回。

本测试通过真实 UI 操作复现：拖拽分屏 → 滚动左侧面板到中部 → 切到右侧 tab → 切回
→ 断言左侧面板 scrollTop 仍保持在中间位置（而非被归零）。
"""

import os

import pytest

from . import helpers
from .conftest import LARGE_LOG

pytestmark = pytest.mark.e2e

# 第二个文件：5000 行，足以滚动，且不触发 scroll-scaling（固定行高 1:1）
SECOND_LOG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs", "large_dummy.log")


def _scroll_to_middle_and_read(page, logviewer_locator):
    """把指定 logviewer 滚动到中部，返回 (设置后的 scrollTop, scrollHeight)。"""
    return page.evaluate(
        """([locator]) => {
          const el = document.querySelector(locator);
          el.scrollTop = el.scrollHeight * 0.5;
          return { top: el.scrollTop, height: el.scrollHeight };
        }""",
        [logviewer_locator],
    )


def _read_scroll_state(page, logviewer_locator):
    return page.evaluate(
        """(locator) => {
          const el = document.querySelector(locator);
          return { top: el.scrollTop, height: el.scrollHeight };
        }""",
        logviewer_locator,
    )


def _drag_tab_to_split_right(page, tab_name):
    """拖拽指定 tab 到当前组内容区右侧，触发 dockview 右分屏。

    返回 True 表示成功（分屏后出现两个 logviewer 容器）。
    """
    tab = page.locator(f'.dv-tab:has-text("{tab_name}")').first
    tab.wait_for(state="visible", timeout=15000)
    tb = tab.bounding_box()
    assert tb, f"tab '{tab_name}' 不可见"

    # 目标：当前组内容区右侧 90% 处（触发 right drop zone）
    content = page.locator('.dv-content-container').first.bounding_box()
    assert content, "找不到 dockview 内容区"

    page.mouse.move(tb["x"] + tb["width"] / 2, tb["y"] + tb["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(150)
    page.mouse.move(content["x"] + content["width"] * 0.9, content["y"] + content["height"] * 0.5, steps=25)
    page.wait_for_timeout(250)
    page.mouse.up()
    page.wait_for_timeout(1200)

    return page.locator('[data-logviewer]').count() >= 2


@pytest.mark.usefixtures("frontend_errors")
def test_split_switch_tab_preserves_scroll_position(page, frontend_errors):
    """回归：分屏后切换 tab，面板滚动位置必须保持（不跳回首行）。"""
    first_name = os.path.basename(LARGE_LOG)
    second_name = os.path.basename(SECOND_LOG)

    # backend 已 CLI 预加载第一个文件（large_test.log）
    helpers.wait_for_tab(page, first_name, timeout=60000)

    # 打开第二个文件（与第一个在同一组内堆叠成两个 tab）
    helpers.open_file_via_picker(page, SECOND_LOG, timeout=120000)
    page.wait_for_selector('.log-row', timeout=60000)
    page.wait_for_timeout(2000)

    # 拖拽第二个 tab 分屏成左右两组
    assert _drag_tab_to_split_right(page, second_name), "拖拽分屏失败：未出现两个 logviewer 面板"

    # 分屏后两组 aria-label 分别为各自文件名
    first_group = f'div.dv-groupview[aria-label="{first_name}"]'
    second_group = f'div.dv-groupview[aria-label="{second_name}"]'
    page.wait_for_selector(f'{second_group} [data-logviewer]', timeout=15000)

    second_lv = f'{second_group} [data-logviewer]'
    first_lv = f'{first_group} [data-logviewer]'

    # 点击第二个 tab，使其所在组成为 active（若尚未激活）
    page.locator(f'.dv-tab:has-text("{second_name}")').first.click(timeout=10000)
    page.wait_for_timeout(500)

    # 滚动第二个面板到中部，记录期望位置
    scrolled = _scroll_to_middle_and_read(page, second_lv)
    expected_top = scrolled["top"]
    assert expected_top > 0, "滚动失败：scrollTop 应为 0 以上的值"

    # 切到第一个 tab（第二个组变 inactive → 触发浏览器归零；看门狗应拉回）
    page.locator(f'.dv-tab:has-text("{first_name}")').first.click(timeout=10000)
    page.wait_for_timeout(600)

    # 切回第二个 tab（再次触发归零，看门狗再次拉回）
    page.locator(f'.dv-tab:has-text("{second_name}")').first.click(timeout=10000)
    page.wait_for_timeout(600)

    # 断言：第二个面板滚动位置保持（没有被归零回跳）
    after = _read_scroll_state(page, second_lv)
    assert after["height"] == scrolled["height"], f"滚动高度变化异常: {scrolled['height']} -> {after['height']}"
    assert abs(after["top"] - expected_top) < 5, (
        f"分屏切换 tab 后滚动位置回退：期望 {expected_top:.1f}，实际 {after['top']:.1f}（回归：跳回首行）"
    )

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
