"""
缓存/工作区回归测试（e2e）：验证 VFS-SQLite 缓存变更引入的 UI 行为。

覆盖问题：
1. Bug1：关闭文件后二次打开卡在 "Loading lines..."（bridgedCounts 未清除
   导致跳过后端 openFile）。应能正常显示行数。
2. Bug3：dockview tab 关闭文件 → 移入"历史文件"栏，点击可重新打开。
3. 相对路径工作区配置解析 + 重复条目去重（large_test.log 曾报 File not found）。
"""

import os
import subprocess
import tempfile

import pytest

from . import helpers

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="module")
def small_log_path():
    """生成一个小日志文件，避免依赖 1.3GB 大文件。"""
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "small.log")
        with open(path, "w", encoding="utf-8") as f:
            for i in range(100):
                f.write(f"line {i}: e2e test data\n")
        yield path


def _wait_text(page, text, timeout=15000):
    page.wait_for_selector(f":text('{text}')", timeout=timeout)


def _open_via_picker(page, path):
    helpers.open_file_via_picker(page, path, timeout=60000)


def _close_file_via_tab(page, file_name):
    """hover 到指定文件的 dockview tab 使其关闭按钮显示，再点击关闭。"""
    tab = page.locator(f'.dv-default-tab:has-text("{file_name}")').first
    tab.hover(timeout=10000)
    page.wait_for_timeout(300)
    close_btn = tab.locator('.dv-default-tab-action .dv-svg').first
    close_btn.click(timeout=10000, force=True)


@pytest.mark.usefixtures("frontend_errors")
def test_close_and_reopen_shows_lines(page, small_log_path, frontend_errors):
    """回归 Bug1：关闭文件后二次打开能正常显示行数，不卡 loading。

    操作：UI 打开 small.log → dockview tab 出现 → 点 tab X 关闭（移入历史文件栏）
    → 点击历史文件栏重新打开 → 应显示 100 Lines（而非一直 Loading lines）。
    """
    _open_via_picker(page, small_log_path)
    # 已打开栏出现文件名
    _wait_text(page, os.path.basename(small_log_path))
    page.wait_for_selector('.log-row', timeout=60000)

    # 关闭文件
    _close_file_via_tab(page, os.path.basename(small_log_path))
    assert page.locator(':text("历史文件")').count() > 0, "关闭后应出现历史文件栏"

    # 历史文件栏中点击 small.log 重新打开（locator 自动等待出现）
    page.locator(
        f'div[title="点击重新打开"]:has(span:text-is("{os.path.basename(small_log_path)}"))'
    ).first.click(timeout=10000, force=True)

    # 应显示 100 Lines（而非 0 / Loading）
    _wait_text(page, "100 Lines", timeout=15000)
    state = helpers.collect_canvas_state(page)
    total, _ = helpers.parse_aria_label(state["ariaLabel"])
    assert total == 100, f"二次打开后行数异常: {total}"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_close_moves_to_history_not_open(page, small_log_path, frontend_errors):
    """回归 Bug3：关闭文件后从已打开（tab）移到"历史文件"，不再残留在打开状态。"""
    _open_via_picker(page, small_log_path)
    _wait_text(page, os.path.basename(small_log_path))
    page.wait_for_selector('.log-row', timeout=60000)

    _close_file_via_tab(page, os.path.basename(small_log_path))

    # small.log 应移入历史文件栏（事件驱动等待出现）
    page.wait_for_selector(
        f'div[title="点击重新打开"]:has(span:text-is("{os.path.basename(small_log_path)}"))',
        timeout=10000,
    )
    history_items = page.locator('div[title="点击重新打开"]')
    hist_texts = history_items.all_text_contents()
    assert os.path.basename(small_log_path) in hist_texts, (
        f"small.log 应出现在历史文件栏，实际: {hist_texts}"
    )
    # small.log 的 dockview tab 应已关闭（面板移除）
    tab = page.locator(f'.dv-tab:has-text("{os.path.basename(small_log_path)}")')
    assert tab.count() == 0, "关闭后 small.log 的 tab 应消失"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_history_delete_button_removes_entry(page, small_log_path, frontend_errors):
    """issue #4 历史文件删除按钮：hover 显示 ✕，点击后条目从历史列表移除。"""
    _open_via_picker(page, small_log_path)
    _wait_text(page, os.path.basename(small_log_path))
    page.wait_for_selector('.log-row', timeout=60000)

    # 关闭文件 → 移入历史文件栏
    _close_file_via_tab(page, os.path.basename(small_log_path))
    history_item = page.locator(
        f'div[title="点击重新打开"]:has(span:text-is("{os.path.basename(small_log_path)}"))'
    )
    history_item.first.wait_for(timeout=10000)

    # hover 显示删除按钮并点击
    history_item.first.hover(timeout=5000)
    del_btn = history_item.locator('button[title="从历史中删除"]').first
    del_btn.wait_for(state="visible", timeout=5000)
    del_btn.click(timeout=5000, force=True)

    # 条目应从历史列表消失
    history_item.first.wait_for(state="detached", timeout=10000)
    history_items = page.locator('div[title="点击重新打开"]')
    assert os.path.basename(small_log_path) not in history_items.all_text_contents(), (
        "删除后 small.log 不应再出现在历史文件栏"
    )

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
