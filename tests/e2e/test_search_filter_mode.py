"""过滤模式 e2e 验收（fix-search-mode-parity / 任务 1.5）。

追溯 spec: find-widget-per-panel → "过滤模式隐藏不匹配行" / "清空搜索恢复完整视图"。

前置：backend(12345) + vite(3000)，由 conftest 自动启动。
"""

import os
import tempfile

import pytest

from . import helpers

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="module")
def search_log():
    """6 行日志，其中 2 行包含 MATCH。"""
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "search-filter.log")
        with open(path, "w", encoding="utf-8") as f:
            f.write("ERROR MATCH alpha\n")
            f.write("INFO noise one\n")
            f.write("ERROR MATCH beta\n")
            f.write("INFO noise two\n")
            f.write("ERROR other gamma\n")
            f.write("INFO noise three\n")
        yield path


def _row_count(page):
    return page.locator(".log-row").count()


def _search(page, query):
    page.keyboard.press("Control+f")
    page.wait_for_selector('input[placeholder="查找"]:visible', timeout=10000)
    inp = page.locator('input[placeholder="查找"]:visible')
    inp.fill(query)
    inp.press("Enter")
    page.locator("text=/\\d+ \\/ \\d+/").filter(visible=True).first.wait_for(
        state="visible", timeout=15000
    )


@pytest.mark.usefixtures("frontend_errors")
def test_filter_mode_hides_non_matching_rows(page, search_log, frontend_errors):
    """搜索后切过滤模式只显示匹配行；清空搜索恢复完整视图。"""
    helpers.open_file_via_picker(page, search_log)
    page.wait_for_selector(".log-row:visible", timeout=60000)
    page.wait_for_function("() => document.querySelectorAll('.log-row').length === 6")

    _search(page, "MATCH")

    # 仅高亮模式：仍然渲染全部 6 行
    assert _row_count(page) == 6, "高亮模式不应隐藏行"

    # 切到过滤模式：只渲染 2 个匹配行
    page.locator('button[title^="当前: 仅高亮模式"]').click()
    page.wait_for_function(
        "() => document.querySelectorAll('.log-row').length === 2", timeout=15000
    )
    visible_text = " ".join(page.locator(".log-row-content:visible").all_inner_texts())
    assert "MATCH" in visible_text, f"过滤后应保留匹配行: {visible_text!r}"
    assert "noise" not in visible_text, f"过滤后不应出现不匹配行: {visible_text!r}"

    # 清空搜索（Esc 两段式：先收起查找条，再清空搜索）→ 恢复完整视图
    page.locator('input[placeholder="查找"]:visible').click()
    page.keyboard.press("Escape")
    page.keyboard.press("Escape")
    page.wait_for_function(
        "() => document.querySelectorAll('.log-row').length === 6", timeout=15000
    )

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
