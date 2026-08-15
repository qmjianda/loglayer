"""
滚轮缩放回归测试：超大文件（useScaling 启用）下滚轮滚动不应被缩放比放大。

背景：滚动缩放把物理滚动高度压缩到 3000 万 px，逻辑高度达 4.58 亿 px。
原生滚轮移动物理像素会被 ~15 倍放大，每格跳 ~76 行。修复后滚轮按逻辑行滚动，
物理 scrollTop 只移动反缩放后的小量（100px 逻辑 → ~6.5px 物理）。
"""

import pytest

from . import helpers

pytestmark = [pytest.mark.e2e, pytest.mark.heavy]


@pytest.mark.usefixtures("frontend_errors")
def test_wheel_scroll_not_amplified(page, large_log_path, frontend_errors):
    helpers.open_file_via_picker(page, large_log_path, timeout=120000)

    # 在滚动容器上派发一次滚轮（deltaY=100 逻辑像素，deltaMode=0）
    result = page.evaluate(
        """() => {
          const sc = document.querySelector('[data-logviewer]');
          const before = sc.scrollTop;
          sc.dispatchEvent(new WheelEvent('wheel', {
            deltaY: 100, deltaMode: 0, bubbles: true, cancelable: true,
          }));
          return { before, after: sc.scrollTop };
        }"""
    )

    delta = result["after"] - result["before"]
    # 修复后：100 逻辑像素反缩放为 ~6.5 物理像素；若 handler 缺失则 delta=0（合成事件不触发原生滚动），
    # 若按物理像素原生滚动则 delta≈100
    assert 0 < delta < 30, f"滚轮滚动未按逻辑行反缩放：物理 scrollTop 移动 {delta}px（应 0<delta<30）"

    assert not frontend_errors, f"前端出现错误: {frontend_errors}"
