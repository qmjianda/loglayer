"""
Ctrl+G 跳转框唯一性与滚动无副作用 e2e 测试（fix-ctrl-g-duplicate-widget）。

覆盖 spec jump-navigation 新增验收场景：
1. 按下 Ctrl+G 只弹出一个"跳转到行"输入框
2. 滚动到文件中部按 Ctrl+G，滚动位置不变、跳转框可见
3. 跳转框已打开时再按 Ctrl+G，不新建实例且输入框获得焦点

前置：backend(12345) + vite(3000)，conftest 自动启动。
"""

import os
import tempfile

import pytest

from . import helpers

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="module")
def scrollable_log():
    """生成可滚动的日志文件（3000 行 × 20px 行高 ≈ 60000px 滚动高度）。"""
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "goto.log")
        with open(path, "w", encoding="utf-8") as f:
            for i in range(3000):
                f.write(f"goto line {i} some-log-content\n")
        yield path


def _goto_input(page):
    return page.locator('input[placeholder^="输入行号"]')


@pytest.mark.usefixtures("frontend_errors")
def test_ctrl_g_opens_single_widget(page, scrollable_log, frontend_errors):
    """按下 Ctrl+G 只出现一个跳转框。"""
    helpers.open_file_via_picker(page, scrollable_log)
    page.wait_for_selector(".log-row:visible", timeout=60000)

    assert _goto_input(page).count() == 0, "初始不应有跳转框"

    page.keyboard.press("Control+g")
    inp = _goto_input(page)
    inp.wait_for(state="visible", timeout=5000)
    count = inp.count()
    # 修复前：全局 + LogViewer 两套监听 → 出现两个输入框
    assert count == 1, f"Ctrl+G 应只打开一个跳转框，实际 {count} 个"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_ctrl_g_does_not_scroll_to_top(page, scrollable_log, frontend_errors):
    """滚动到文件中部按 Ctrl+G：scrollTop 不变、跳转框可见。"""
    helpers.open_file_via_picker(page, scrollable_log)
    page.wait_for_selector(".log-row:visible", timeout=60000)

    before = page.evaluate(
        """() => {
          const el = document.querySelector('[data-logviewer]');
          el.scrollTop = el.scrollHeight * 0.5;
          return el.scrollTop;
        }"""
    )
    assert before > 100, "前置失败：应已滚动到中部"

    page.keyboard.press("Control+g")
    _goto_input(page).first.wait_for(state="visible", timeout=5000)
    page.wait_for_timeout(500)

    after = page.evaluate("() => document.querySelector('[data-logviewer]').scrollTop")
    # 修复前：内嵌 widget autofocus 触发 scroll-into-view → scrollTop 归零
    assert abs(after - before) < 5, f"按 Ctrl+G 后滚动位置被改变：{before:.0f} -> {after:.0f}"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_ctrl_g_repeat_focuses_existing_widget(page, scrollable_log, frontend_errors):
    """跳转框已打开时再按 Ctrl+G：仍只有一个输入框，且输入框获得焦点。"""
    helpers.open_file_via_picker(page, scrollable_log)
    page.wait_for_selector(".log-row:visible", timeout=60000)

    page.keyboard.press("Control+g")
    _goto_input(page).first.wait_for(state="visible", timeout=5000)

    page.keyboard.press("Control+g")
    page.wait_for_timeout(500)

    inp = _goto_input(page)
    count = inp.count()
    assert count == 1, f"重复 Ctrl+G 不应新建跳转框，实际 {count} 个"
    focused = inp.first.evaluate("(el) => document.activeElement === el")
    assert focused, "重复 Ctrl+G 后输入框应获得焦点"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
