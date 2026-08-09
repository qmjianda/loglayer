"""
find widget per-tab 化 e2e 测试（单面板行为，非分屏）。

覆盖 spec find-widget-per-panel 的验收场景（分屏并存场景降级为手动验证）：
1. Ctrl+F 打开激活面板的 find widget 并聚焦输入框
2. Ctrl+F 重复按下 = 聚焦输入框并全选已有词（VSCode 语义）
3. 切 tab 后各面板 find 可见性与词独立记忆（回归）

前置：backend(12345) + vite(3000)，conftest 自动启动。
"""

import os
import tempfile

import pytest

from . import helpers

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="module")
def two_log_files():
    """生成两个内容不同的小日志文件，用于面板独立性验证。"""
    with tempfile.TemporaryDirectory() as d:
        path_a = os.path.join(d, "alpha.log")
        path_b = os.path.join(d, "beta.log")
        with open(path_a, "w", encoding="utf-8") as f:
            for i in range(10):
                f.write(f"alpha line {i} unique-token-alpha\n")
        with open(path_b, "w", encoding="utf-8") as f:
            for i in range(10):
                f.write(f"beta line {i} unique-token-beta\n")
        yield path_a, path_b


def _open_via_picker(page, path):
    helpers.open_file_via_picker(page, path)


def _switch_tab(page, file_name):
    page.locator(".dv-tab", has_text=file_name).click(timeout=10000)
    page.wait_for_timeout(2000)


def _find_input(page):
    return page.locator('input[placeholder="查找"]')


@pytest.mark.usefixtures("frontend_errors")
def test_ctrl_f_opens_and_focuses_find_widget(page, two_log_files, frontend_errors):
    """Ctrl+F 打开激活面板的 find widget 并聚焦输入框。"""
    path_a, _ = two_log_files
    _open_via_picker(page, path_a)
    page.wait_for_selector(".log-row", timeout=60000)

    # 初始无 find widget
    assert _find_input(page).count() == 0, "初始不应有 find widget"

    page.keyboard.press("Control+f")
    inp = _find_input(page)
    inp.wait_for(state="visible", timeout=5000)
    assert inp.count() == 1, "Ctrl+F 应打开 find widget"
    # 输入框获得焦点
    assert inp.evaluate("(el) => document.activeElement === el"), "Ctrl+F 后输入框应聚焦"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_ctrl_f_repeat_selects_existing_query(page, two_log_files, frontend_errors):
    """Ctrl+F 重复按下 = 聚焦并全选已有词（VSCode 语义）。"""
    path_a, _ = two_log_files
    _open_via_picker(page, path_a)
    page.wait_for_selector(".log-row", timeout=60000)

    # 首次 Ctrl+F，输入词
    page.keyboard.press("Control+f")
    inp = _find_input(page)
    inp.wait_for(state="visible", timeout=5000)
    inp.fill("unique-token-alpha")
    # 失焦后再次 Ctrl+F
    page.keyboard.press("Escape")
    _find_input(page).wait_for(state="detached", timeout=5000)

    page.keyboard.press("Control+f")
    inp = _find_input(page)
    inp.wait_for(state="visible", timeout=5000)
    # 词应保留
    assert inp.input_value() == "unique-token-alpha", "再次 Ctrl+F 应保留上次词"
    # 输入框聚焦且全选
    sel = inp.evaluate(
        """(el) => {
            return {
              focused: document.activeElement === el,
              start: el.selectionStart,
              end: el.selectionEnd,
              len: el.value.length,
            };
        }"""
    )
    assert sel["focused"], "Ctrl+F 重复按下后输入框应聚焦"
    assert sel["start"] == 0 and sel["end"] == sel["len"], f"应全选已有词: {sel}"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


@pytest.mark.usefixtures("frontend_errors")
def test_find_visibility_remembered_per_tab(page, two_log_files, frontend_errors):
    """切 tab 后各面板 find 可见性与词独立记忆（回归）。"""
    path_a, path_b = two_log_files
    name_a, name_b = os.path.basename(path_a), os.path.basename(path_b)

    _open_via_picker(page, path_a)
    page.wait_for_selector(".log-row", timeout=60000)
    page.keyboard.press("Control+f")
    inp = _find_input(page)
    inp.wait_for(state="visible", timeout=5000)
    inp.fill("unique-token-alpha")

    # 打开面板 B：B 的 find 初始隐藏（per-tab 记忆）
    _open_via_picker(page, path_b)
    page.wait_for_selector(".log-row", timeout=60000)
    assert _find_input(page).count() == 0, "面板 B find 不应自动打开"

    # B 打开 find 并搜索自己的词
    page.keyboard.press("Control+f")
    inp_b = _find_input(page)
    inp_b.wait_for(state="visible", timeout=5000)
    inp_b.fill("unique-token-beta")

    # 切回 A：find 恢复为打开且词为 A 的词
    _switch_tab(page, name_a)
    inp_a = _find_input(page)
    inp_a.wait_for(state="visible", timeout=10000)
    assert inp_a.input_value() == "unique-token-alpha", "切回 A 应恢复 A 的搜索词"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
