"""
IT（e2e）回归：分屏切换 tab 时，各面板滚动位置必须保持，不得跳回首行。

背景 Bug：dockview 默认渲染策略 onlyWhenVisible 在切 tab 时对失活面板执行
element.remove()（把内容 DOM 移出文档树），重新激活时 appendChild 插回，
导致 scrollTop 归零且静默（不触发 scroll 事件）—— 表现为"切 tab 后进度跳回首行"。
修复：dockview 改为 defaultRenderer="always"，失活面板内容常驻 DOM
（visibility:hidden 隐藏），scrollTop 原生保持，无需逐帧看门狗拉回。

本测试通过真实 UI 操作复现：拖拽分屏 → 滚动左侧面板到中部 → 切到右侧 tab → 切回
→ 断言左侧面板 scrollTop 仍保持在中间位置（而非被归零）。
"""

import os
import tempfile

import pytest

from . import helpers

pytestmark = pytest.mark.e2e

# 第二个文件：5000 行，足以滚动，且不触发 scroll-scaling（固定行高 1:1）
SECOND_LOG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs", "large_dummy.log")


def _scroll_to_middle_and_read(page, lv_index):
    """把指定 logviewer 滚动到中部，返回 (设置后的 scrollTop, scrollHeight)。"""
    return page.evaluate(
        """(index) => {
          const el = document.querySelectorAll('[data-logviewer]')[index];
          el.scrollTop = el.scrollHeight * 0.5;
          return { top: el.scrollTop, height: el.scrollHeight };
        }""",
        lv_index,
    )


def _read_scroll_state(page, lv_index):
    return page.evaluate(
        """(index) => {
          const el = document.querySelectorAll('[data-logviewer]')[index];
          return { top: el.scrollTop, height: el.scrollHeight };
        }""",
        lv_index,
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
def test_split_switch_tab_preserves_scroll_position(page, frontend_errors, tmp_path):
    """回归：分屏后切换 tab，面板滚动位置必须保持（不跳回首行）。"""
    # 第一个文件：临时小文件（滚动位置保持与文件大小无关，避免大文件索引成本）
    first_log = tmp_path / "first.log"
    first_log.write_text("".join(f"first line {i}\n" for i in range(200)), encoding="utf-8")
    first_name = first_log.name
    second_name = os.path.basename(SECOND_LOG)

    helpers.open_file_via_picker(page, str(first_log), timeout=120000)

    # 打开第二个文件（与第一个在同一组内堆叠成两个 tab）
    helpers.open_file_via_picker(page, SECOND_LOG, timeout=120000)
    page.wait_for_selector('.log-row:visible', timeout=60000)
    page.wait_for_timeout(2000)

    # 拖拽第二个 tab 分屏成左右两组
    assert _drag_tab_to_split_right(page, second_name), "拖拽分屏失败：未出现两个 logviewer 面板"

    # always 渲染策略下面板内容位于 shell 层 overlay（不在 .dv-groupview 内），
    # 改用全局 [data-logviewer] 按 DOM 顺序定位（先打开 first.log → idx 0，后打开 large_dummy.log → idx 1）
    page.wait_for_function(
        "() => document.querySelectorAll('[data-logviewer]').length >= 2",
        timeout=15000,
    )
    first_lv_index = 0
    second_lv_index = 1

    # 拖拽移动面板后内容仍显示（覆盖 dockview always 的 move 坑）
    page.wait_for_function(
        "() => Array.from(document.querySelectorAll('[data-logviewer]'))"
        ".filter((el) => el.querySelector('.log-row')).length >= 2",
        timeout=15000,
    )

    # 点击第二个 tab，使其所在组成为 active（若尚未激活）
    page.locator(f'.dv-tab:has-text("{second_name}")').first.click(timeout=10000)
    page.wait_for_timeout(500)

    # 滚动第二个面板到中部，记录期望位置
    scrolled = _scroll_to_middle_and_read(page, second_lv_index)
    expected_top = scrolled["top"]
    assert expected_top > 0, "滚动失败：scrollTop 应为 0 以上的值"

    # 切到第一个 tab（第二个组变 inactive → 触发浏览器归零；看门狗应拉回）
    page.locator(f'.dv-tab:has-text("{first_name}")').first.click(timeout=10000)
    page.wait_for_timeout(600)

    # 切回第二个 tab（再次触发归零，看门狗再次拉回）
    page.locator(f'.dv-tab:has-text("{second_name}")').first.click(timeout=10000)
    page.wait_for_timeout(600)

    # 断言：第二个面板滚动位置保持（没有被归零回跳）
    after = _read_scroll_state(page, second_lv_index)
    assert after["height"] == scrolled["height"], f"滚动高度变化异常: {scrolled['height']} -> {after['height']}"
    assert abs(after["top"] - expected_top) < 5, (
        f"分屏切换 tab 后滚动位置回退：期望 {expected_top:.1f}，实际 {after['top']:.1f}（回归：跳回首行）"
    )

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
