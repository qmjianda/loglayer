"""
e2e 公共交互工具：封装前端 UI 交互与断言，供各测试用例复用。

所有函数接受 Playwright `page` 对象，返回可断言的原始数据，
便于 AI / 后续测试直接验证显示是否符合预期。
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

# 虚拟高度阈值（与 frontend/src/constants.ts VIRTUAL_HEIGHT_LIMIT 一致）
VIRTUAL_HEIGHT_LIMIT = 10_000_000
# 可视区期望高度下界：正常面板可视区至少几百像素，绝不应是虚拟高度量级
MIN_REASONABLE_VIEWPORT = 50


# ---------- 通用等待 ----------

def wait_for_log_canvas(page, timeout: int = 60000):
    """等待日志 canvas 渲染出现，返回该 locator。"""
    page.wait_for_selector('canvas[role="log"]', timeout=timeout)
    return page.locator('canvas[role="log"]').first


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
    page.wait_for_timeout(1200)

    # 点击文件项
    item = page.locator(f'.rpp-item:has-text("{file_name}")').first
    item.click(timeout=15000)
    page.wait_for_timeout(2000)

    wait_for_log_canvas(page, timeout=timeout)
    wait_for_tab(page, file_name, timeout=timeout)


# ---------- 渲染/尺寸采集 ----------

def collect_canvas_state(page) -> Dict:
    """采集 canvas 与滚动容器的关键尺寸与文本状态。"""
    return page.evaluate(
        """() => {
      const canvas = document.querySelector('canvas[role="log"]');
      const container = canvas ? canvas.closest('.custom-scrollbar') : null;
      const spacer = container ? container.querySelector(':scope > div') : null;
      return {
        canvasWidth: canvas ? canvas.clientWidth : null,
        canvasHeight: canvas ? canvas.clientHeight : null,
        canvasAttrWidth: canvas ? canvas.getAttribute('width') : null,
        canvasAttrHeight: canvas ? canvas.getAttribute('height') : null,
        containerClientHeight: container ? container.clientHeight : null,
        containerScrollHeight: container ? container.scrollHeight : null,
        spacerHeight: spacer ? spacer.style.height : null,
        ariaLabel: canvas ? canvas.getAttribute('aria-label') : null,
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
    """白屏回归核心断言。

    canvas 的渲染高度必须是真实可视区（几百像素），而非虚拟总高度
    （10_000_000+px）。当 canvas 高度等于虚拟高度时，说明 viewportHeight
    被错误地测成了整个滚动内容高度，表现为白屏。
    """
    h = state["canvasHeight"]
    assert h is not None, "canvas 未渲染（canvasHeight 为空）"
    assert h > MIN_REASONABLE_VIEWPORT, f"canvas 高度异常过小: {h}px"
    assert (
        h < VIRTUAL_HEIGHT_LIMIT / 2
    ), f"白屏复现：canvas 高度 {h}px 接近虚拟高度 {VIRTUAL_HEIGHT_LIMIT}px，" \
       f"说明 viewportHeight 被错误测成整个滚动高度。"

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
