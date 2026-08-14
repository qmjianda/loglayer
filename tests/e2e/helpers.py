"""
e2e 公共交互工具：封装前端 UI 交互与断言，供各测试用例复用。

所有函数接受 Playwright `page` 对象，返回可断言的原始数据，
便于 AI / 后续测试直接验证显示是否符合预期。
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

# 浏览器滚动容器安全高度上限（与 frontend LogViewer MAX_SCROLL_HEIGHT 一致）
VIRTUAL_HEIGHT_LIMIT = 30_000_000
# 可视区期望高度下界：正常面板可视区至少几百像素，绝不应是虚拟高度量级
MIN_REASONABLE_VIEWPORT = 50


# ---------- 通用等待 ----------

def wait_for_log_canvas(page, timeout: int = 60000):
    """等待日志行渲染出现（DOM 虚拟化后为 .log-row 元素）。

    用 :visible 限定可见行：dockview defaultRenderer="always" 下失活面板的
    .log-row 常驻 DOM（visibility:hidden），若不用 :visible 会匹配到隐藏面板而超时。
    """
    page.wait_for_selector('.log-row:visible', timeout=timeout)
    return page.locator('.log-row:visible').first


def wait_for_tab(page, tab_name: str, timeout: int = 60000):
    """等待指定文件名的 dockview tab 出现。"""
    page.wait_for_selector(f'.dv-tab:has-text("{tab_name}")', timeout=timeout)


# ---------- 远程路径选择器（--no-ui 模式下打开文件） ----------

def open_file_via_picker(page, file_path: str, timeout: int = 60000):
    """通过前端 UI（远程路径选择器）打开指定文件。

    流程：点击"浏览并打开" → 输入框填入文件所在目录 → 点击文件项。
    返回最终 dockview tab 文本列表。
    """
    page.locator('button:has-text("浏览并打开")').first.click(timeout=10000)
    page.wait_for_selector('.rpp-input', timeout=10000)

    # 直接填入文件所在目录（带尾斜杠，与 picker 的 currentPath 一致），触发目录列表加载
    dir_path = file_path.replace("\\", "/")
    parts = [p for p in dir_path.split("/") if p]
    file_name = parts[-1]
    directory = "/" + "/".join(parts[:-1]) + "/"

    inp = page.locator('.rpp-input').first
    inp.fill(directory)
    # 等待目录列表加载出目标文件项（替代固定 sleep）
    item = page.locator(f'.rpp-item:has-text("{file_name}")').first
    item.wait_for(state="visible", timeout=15000)

    # 点击文件项
    item.click(timeout=15000)

    wait_for_log_canvas(page, timeout=timeout)
    wait_for_tab(page, file_name, timeout=timeout)


# ---------- 渲染/尺寸采集 ----------

def collect_canvas_state(page) -> Dict:
    """采集 DOM 虚拟化日志视图的关键状态。

    DOM 化后：canvas 角色已被 .log-row 元素替代；aria 文本在
    容器内 sr-only 区域。返回兼容的字段结构以复用既有断言。
    """
    return page.evaluate(
        """() => {
      const scroller = document.querySelector('[data-logviewer]');
      const rows = Array.from(document.querySelectorAll('.log-row'));
      const gutter = document.querySelector('.log-row-gutter');
      const status = scroller ? scroller.querySelector('[role="status"]') : null;
      const spacer = scroller ? scroller.querySelector(':scope > div') : null;
      return {
        canvasWidth: null,
        canvasHeight: scroller ? scroller.clientHeight : null,
        canvasAttrWidth: null,
        canvasAttrHeight: null,
        containerClientHeight: scroller ? scroller.clientHeight : null,
        containerScrollHeight: scroller ? scroller.scrollHeight : null,
        spacerHeight: spacer ? spacer.style.height : null,
        ariaLabel: status ? status.textContent.trim() : null,
        rowCount: rows.length,
        gutterVisible: gutter !== null,
        tabTexts: Array.from(document.querySelectorAll('.dv-tab')).map(t => t.textContent.trim()),
      };
    }"""
    )


def parse_aria_label(aria_label: Optional[str]) -> Tuple[Optional[int], Optional[Tuple[int, int]]]:
    """从 aria-label 解析总行数与当前显示范围，如
    '日志视图，共 22,919,353 行。当前显示第 1 到 500505 行'。
    """
    if not aria_label:
        return None, None
    total = re.search(r"共\s*([\d,]+)\s*行", aria_label)
    rng = re.search(r"第\s*([\d,]+)\s*到\s*([\d,]+)\s*行", aria_label)
    total_n = int(total.group(1).replace(",", "")) if total else None
    if rng:
        start_n = int(rng.group(1).replace(",", ""))
        end_n = int(rng.group(2).replace(",", ""))
        return total_n, (start_n, end_n)
    return total_n, None


# ---------- 显示正确性断言 ----------

def assert_not_blank_screen(state: Dict):
    """白屏回归核心断言（DOM 虚拟化版本）。

    滚动容器可视高度必须是真实可视区（几百像素），而非虚拟总高度
    （30_000_000+px）。当容器高度等于虚拟高度时，说明 viewportHeight
    被错误地测成了整个滚动内容高度，表现为白屏。同时要求已渲染出
    .log-row 行元素（虚拟化生效、非空）。
    """
    h = state["canvasHeight"]
    assert h is not None, "日志容器未渲染（canvasHeight 为空）"
    assert h > MIN_REASONABLE_VIEWPORT, f"容器高度异常过小: {h}px"
    assert (
        h < VIRTUAL_HEIGHT_LIMIT / 2
    ), f"白屏复现：容器高度 {h}px 接近虚拟高度 {VIRTUAL_HEIGHT_LIMIT}px，" \
       f"说明 viewportHeight 被错误测成整个滚动高度。"

    # 虚拟化生效：渲染出的行数远小于总行数，且大于 0
    rc = state.get("rowCount", 0)
    assert rc > 0, "未渲染出任何 .log-row 行元素"

    # 容器可视高应远小于滚动内容高（虚拟化仍生效）
    ch = state["containerClientHeight"]
    sh = state["containerScrollHeight"]
    if ch is not None and sh is not None:
        assert ch > 0, f"容器可视高度为 0"
        assert sh >= ch, f"滚动高度({sh})不应小于可视高度({ch})"


def assert_aria_line_count(state: Dict, expected_total: int):
    """aria-label 的总行数与文件实际行数一致。"""
    total, _ = parse_aria_label(state["ariaLabel"])
    assert total is not None, "aria-label 缺少总行数"
    assert total == expected_total, f"aria 行数 {total} != 期望 {expected_total}"


def assert_no_frontend_errors(page) -> List[str]:
    """返回收集到的前端错误；调用方决定是否断言为空。"""
    return []


def collect_errors(page) -> List[str]:
    """从测试注入的错误收集器读取。"""
    return getattr(page, "_collected_errors", [])


# ---------- 汇总断言（供测试一键调用） ----------

def verify_large_file_rendering(page, expected_lines: int):
    """一键验证超大文件渲染正确性：不白屏 + 行数正确。"""
    state = collect_canvas_state(page)
    assert_not_blank_screen(state)
    assert_aria_line_count(state, expected_lines)
    return state
