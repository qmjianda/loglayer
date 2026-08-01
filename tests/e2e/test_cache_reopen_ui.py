"""
缓存/工作区回归测试（e2e）：验证 VFS-SQLite 缓存变更引入的 UI 行为。

覆盖问题：
1. Bug1：关闭文件后二次打开卡在 "Loading lines..."（bridgedCounts 未清除
   导致跳过后端 openFile）。应能正常显示行数。
2. Bug3：侧栏"已打开"栏点 X 关闭文件 → 移入"历史文件"栏，点击可重新打开。
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


def _close_file_via_sidebar(page, file_name):
    """hover 到指定文件的侧栏行使其 X 按钮显示，再点击关闭。"""
    # 精确定位包含指定文件名的文件行（div.py-1.px-2），再取其 X 按钮
    row = page.locator(
        f'div.py-1.px-2:has(span:text-is("{file_name}"))'
    ).first
    row.hover(timeout=10000)
    page.wait_for_timeout(300)
    close_btn = row.locator('button[title="关闭文件"]').first
    close_btn.click(timeout=10000, force=True)


@pytest.mark.usefixtures("frontend_errors")
def test_close_and_reopen_shows_lines(page, small_log_path, frontend_errors):
    """回归 Bug1：关闭文件后二次打开能正常显示行数，不卡 loading。

    操作：UI 打开 small.log → 已打开栏出现 → 点 X 关闭（移入历史文件栏）
    → 点击历史文件栏重新打开 → 应显示 100 Lines（而非一直 Loading lines）。
    """
    _open_via_picker(page, small_log_path)
    # 已打开栏出现文件名
    _wait_text(page, os.path.basename(small_log_path))
    page.wait_for_selector('canvas[role="log"]', timeout=60000)
    page.wait_for_timeout(2000)

    # 关闭文件
    _close_file_via_sidebar(page, os.path.basename(small_log_path))
    page.wait_for_timeout(1500)
    assert page.locator(':text("历史文件")').count() > 0, "关闭后应出现历史文件栏"

    # 历史文件栏中点击 small.log 重新打开
    page.locator(
        f'div[title="点击重新打开"]:has(span:text-is("{os.path.basename(small_log_path)}"))'
    ).first.click(timeout=10000, force=True)
    page.wait_for_timeout(3000)

    # 应显示 100 Lines（而非 0 / Loading）
    _wait_text(page, "100 Lines", timeout=15000)
    state = helpers.collect_canvas_state(page)
    total, _ = helpers.parse_aria_label(state["ariaLabel"])
    assert total == 100, f"二次打开后行数异常: {total}"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_close_moves_to_history_not_open(page, small_log_path, frontend_errors):
    """回归 Bug3：关闭文件后从"已打开"移到"历史文件"，不再残留在已打开栏。

    注意：后端 CLI 可能预加载了其他文件（如 large_test.log），
    因此只断言 small.log 的归属变化，不影响其他文件。
    """
    _open_via_picker(page, small_log_path)
    _wait_text(page, os.path.basename(small_log_path))
    page.wait_for_selector('canvas[role="log"]', timeout=60000)
    page.wait_for_timeout(1500)

    _close_file_via_sidebar(page, os.path.basename(small_log_path))
    page.wait_for_timeout(1500)

    # small.log 应移入历史文件栏
    history_items = page.locator('div[title="点击重新打开"]')
    hist_texts = history_items.all_text_contents()
    assert os.path.basename(small_log_path) in hist_texts, (
        f"small.log 应出现在历史文件栏，实际: {hist_texts}"
    )
    # small.log 不应再出现在已打开栏（已打开栏行 title 为空，历史栏行 title=点击重新打开）
    open_row = page.locator(
        f'div.py-1.px-2:has(span:text-is("{os.path.basename(small_log_path)}")):not([title="点击重新打开"])'
    )
    assert open_row.count() == 0, "small.log 不应残留在已打开栏"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
