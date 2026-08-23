"""
外部标准插件加载 e2e 测试（standardize-plugin-system）。

覆盖验收场景：
1. 应用启动后从 examples/plugins/ 发现 demo-plugin：
   /api/get_layer_registry 含 demo.basics:anonymize（TRANSFORM，后端 logic 引擎）
   /api/get_ui_widgets 含 demo.basics:system-stats（statusbar 槽位）
2. 状态栏渲染出 System Stats widget（声明式元数据 → 静态 renderer）
3. 对已打开文件应用 anonymize 转换层后，处理输出中 IPv4 被 [MASKED] 替换

前置：backend(12345) + vite(3000)，conftest 自动启动。
"""

import os
import tempfile

import pytest

from . import helpers

pytestmark = pytest.mark.e2e


def _get_json(page, path):
    return page.evaluate(
        "async (p) => { const r = await fetch(p); return await r.json(); }",
        path,
    )


@pytest.mark.usefixtures("frontend_errors")
def test_external_demo_plugin_discovered_and_widget_rendered(page, frontend_errors):
    """demo 插件被发现：注册表与状态栏 widget 均可见。"""
    registry = _get_json(page, "/api/get_layer_registry")
    types = [item["type"] for item in registry]
    assert "demo.basics:anonymize" in types

    widgets = _get_json(page, "/api/get_ui_widgets")
    widget_types = [w["type"] for w in widgets]
    assert "demo.basics:system-stats" in widget_types

    # widget 数据按 refresh_interval 轮询，等待状态栏出现数据文本
    has_widget_text = page.wait_for_function(
        """() => {
          const bars = document.querySelectorAll('div.h-6');
          for (const bar of bars) {
            const t = bar.innerText || '';
            if (t.includes('System Stats') || t.includes('CPU')) return true;
          }
          return false;
        }""",
        timeout=15_000,
    )
    assert has_widget_text


@pytest.fixture(scope="module")
def masked_log():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "ips.log")
        with open(path, "w", encoding="utf-8") as f:
            for i in range(20):
                f.write(f"line {i} from 192.168.1.42 action=login\n")
        yield path


@pytest.mark.usefixtures("frontend_errors")
def test_external_transform_masks_processed_output(page, masked_log, frontend_errors):
    """应用 anonymize 转换层后，处理输出中 IP 被 [MASKED]。"""
    helpers.open_file_via_picker(page, masked_log)

    masked = page.evaluate(
        """async ([path]) => {
          const fileId = 'e2e-demo-plugin';
          const opened = await fetch('/api/open_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId, file_path: path }),
          });
          if (!opened.ok) return 'open_failed:' + opened.status;
          const layersJson = JSON.stringify([
            { id: 'l1', type: 'demo.basics:anonymize', enabled: true, config: {} },
          ]);
          const synced = await fetch('/api/sync_layers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId, layers_json: layersJson }),
          });
          if (!synced.ok) return 'sync_failed:' + synced.status;
          // 管线在工作线程异步执行：轮询处理输出直到出现 [MASKED]
          for (let i = 0; i < 30; i++) {
            const res = await fetch(
              '/api/read_processed_lines?file_id=' + fileId + '&start_line=0&count=5',
            );
            const text = JSON.stringify(await res.json());
            if (text.includes('[MASKED]')) return true;
            await new Promise((r) => setTimeout(r, 500));
          }
          return false;
        }""",
        [masked_log],
    )

    assert masked is True, f"processed output never contained [MASKED]: {masked}"
