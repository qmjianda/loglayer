"""
find widget per-tab 化 e2e 测试（单面板行为，非分屏）。

覆盖 spec find-widget-per-panel 的验收场景（分屏并存场景降级为手动验证）：
1. Ctrl+F 打开激活面板的 find widget 并聚焦输入框
2. Ctrl+F 重复按下 = 聚焦输入框并全选已有词（VSCode 语义）
3. 切 tab 后各面板 find 可见性与词独立记忆（回归）

前置：backend(12345) + vite(3000)，conftest 自动启动。
"""

import json
import os
import tempfile
import urllib.parse

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
    # always 渲染策略下所有面板的 find widget 常驻 DOM（失活面板 visibility:hidden），
    # 用 :visible 限定激活面板的输入框
    return page.locator('input[placeholder="查找"]:visible')


@pytest.mark.usefixtures("frontend_errors")
def test_ctrl_f_opens_and_focuses_find_widget(page, two_log_files, frontend_errors):
    """Ctrl+F 打开激活面板的 find widget 并聚焦输入框。"""
    path_a, _ = two_log_files
    _open_via_picker(page, path_a)
    page.wait_for_selector(".log-row:visible", timeout=60000)

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
    page.wait_for_selector(".log-row:visible", timeout=60000)

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
    page.wait_for_selector(".log-row:visible", timeout=60000)
    page.keyboard.press("Control+f")
    inp = _find_input(page)
    inp.wait_for(state="visible", timeout=5000)
    inp.fill("unique-token-alpha")

    # 打开面板 B：B 的 find 初始隐藏（per-tab 记忆）
    _open_via_picker(page, path_b)
    page.wait_for_selector(".log-row:visible", timeout=60000)
    # B 的 find 不应自动打开；always 下 A 失活后 find 隐藏有异步延迟，用等待代替即时 count 避免竞态
    page.wait_for_function(
        """() => Array.from(document.querySelectorAll('input[placeholder="查找"]'))
              .filter((el) => getComputedStyle(el).visibility !== 'hidden').length === 0""",
        timeout=10000,
    )

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


# ---------- 分屏与历史布局场景（fix-ctrl-f-focus-race 验收） ----------


def _drag_second_tab_to_split(page, tab_name):
    """把指定 tab 拖拽分屏到右侧（复用 split 回归测试的手势）。"""
    tab = page.locator(f'.dv-tab:has-text("{tab_name}")').first
    tb = tab.bounding_box()
    assert tb, f"tab '{tab_name}' 不可见"
    content = page.locator('.dv-content-container').first.bounding_box()
    assert content, "找不到 dockview 内容区"
    page.mouse.move(tb["x"] + tb["width"] / 2, tb["y"] + tb["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(150)
    page.mouse.move(content["x"] + content["width"] * 0.9, content["y"] + content["height"] * 0.5, steps=25)
    page.wait_for_timeout(250)
    page.mouse.up()
    page.wait_for_timeout(1200)


def _click_logviewer(page, index):
    """点击第 index 个日志面板内容区，使其成为 dockview 激活面板。"""
    box = page.locator("[data-logviewer]").nth(index).bounding_box()
    assert box, f"logviewer[{index}] 不可见"
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + min(box["height"], 200) / 2)


def _within_bbox(outer, point):
    return outer["x"] <= point["x"] <= outer["x"] + outer["width"] and (
        outer["y"] <= point["y"] <= outer["y"] + outer["height"]
    )


@pytest.mark.usefixtures("frontend_errors")
def test_ctrl_f_targets_active_panel_in_split(page, two_log_files, frontend_errors):
    """分屏下逐面板独立验证：Ctrl+F 始终作用于当前激活面板（spec 场景）。"""
    path_a, path_b = two_log_files

    _open_via_picker(page, path_a)
    _open_via_picker(page, path_b)
    _drag_second_tab_to_split(page, os.path.basename(path_b))
    page.wait_for_function(
        "() => document.querySelectorAll('[data-logviewer]').length >= 2",
        timeout=15000,
    )

    for index in (0, 1):
        lv_box = page.locator("[data-logviewer]").nth(index).bounding_box()
        _click_logviewer(page, index)
        page.keyboard.press("Control+f")
        inp = _find_input(page)
        inp.wait_for(state="visible", timeout=5000)
        assert inp.count() == 1, f"面板 {index}: Ctrl+F 应打开当前激活面板的 find widget"
        assert inp.evaluate("(el) => document.activeElement === el"), (
            f"面板 {index}: Ctrl+F 后输入框应聚焦"
        )
        center = inp.bounding_box()
        center = {"x": center["x"] + center["width"] / 2, "y": center["y"]}
        assert _within_bbox(lv_box, center), (
            f"面板 {index}: find widget 应位于被点击面板内（widget x={center['x']}, "
            f"panel 范围 x=[{lv_box['x']}, {lv_box['x'] + lv_box['width']}]）"
        )
        page.keyboard.press("Escape")
        _find_input(page).wait_for(state="detached", timeout=5000)

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"


def _workspace_dir_of(paths):
    """两个测试文件同目录，取其一作为工作区 folder_path。"""
    return os.path.dirname(paths[0])


def _fetch_layout(page, folder_path):
    raw = page.evaluate(
        """async (fp) => {
            const r = await fetch(`/api/workspace/state?key=layout&folder_path=${encodeURIComponent(fp)}`);
            return await r.json();
        }""",
        folder_path,
    )
    return json.loads(raw) if raw else None


def _put_layout(page, folder_path, layout_json):
    page.evaluate(
        """async ({ fp, value }) => {
            await fetch('/api/workspace/state', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_path: fp, key: 'layout', value }),
            });
        }""",
        {"fp": folder_path, "value": json.dumps(layout_json)},
    )


@pytest.mark.usefixtures("frontend_errors")
def test_legacy_layout_without_panel_param_still_ctrl_f(page, two_log_files, frontend_errors):
    """回归（真实用户路径）：params 缺 panelId 的历史布局恢复后，Ctrl+F 必须可用。

    复现 fix-ctrl-f-focus-race 的根因场景：
    1. 打开文件让布局落盘 → 2. 改写 kv['layout'] 删除 params.panelId（模拟
    2026-08-09 之前版本保存的布局）→ 3. 切换工作区触发重载，面板经
    fromJSON（无 params.panelId）重建 → 4. Ctrl+F。
    """
    path_a, _ = two_log_files
    folder_path = _workspace_dir_of([path_a, path_a])

    _open_via_picker(page, path_a)
    # 布局保存为 500ms 防抖，留足余量等待落盘
    page.wait_for_timeout(2000)

    layout = _fetch_layout(page, folder_path)
    assert layout and layout.get("panels"), "布局应已落盘且包含 panels"
    # 模拟旧版布局：删除全部 panelId 参数副本
    for panel in layout["panels"].values():
        panel.get("params", {}).pop("panelId", None)
    _put_layout(page, folder_path, layout)

    # 切换到同一工作区触发会话重载：文件经 config 恢复、面板经 fromJSON 重建
    # （Ctrl+Shift+O 在 --no-ui 下无远程回退，用 Ctrl+O 的 both 模式选择器选当前文件夹）
    page.keyboard.press("Control+o")
    page.wait_for_selector(".rpp-input", timeout=10000)
    rpp_input = page.locator(".rpp-input").first
    rpp_input.fill(folder_path)
    # 等待目录列表加载出目标文件项（确认 loadDirectory 完成）
    page.locator(f'.rpp-item:has-text("{os.path.basename(path_a)}")').first.wait_for(
        state="visible", timeout=15000
    )
    btn = page.locator('button:has-text("选择此文件夹")')
    btn.click()
    page.wait_for_selector(".log-row:visible", timeout=60000)
    page.wait_for_timeout(1000)

    _click_logviewer(page, 0)
    page.keyboard.press("Control+f")
    inp = _find_input(page)
    inp.wait_for(state="visible", timeout=5000)
    assert inp.count() == 1, "历史布局（无 params.panelId）恢复后 Ctrl+F 应打开 find widget"
    assert inp.evaluate("(el) => document.activeElement === el"), "输入框应聚焦"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
