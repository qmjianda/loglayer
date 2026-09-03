"""remove-webview-dependency 验收测试。

对应 openspec/changes/remove-webview-dependency/specs/shell-file-picker-contract/spec.md：
- 无 webview 依赖的后端启动（import main 不因缺 pywebview 报错）
- 探测端点在无壳环境恒为 False
- 插槽降级：无窗口对象且无 tkinter 时空结果、不抛异常
- 插槽注入：注入鸭子类型窗口对象后走其 create_file_dialog
"""
import json
import os
import pathlib
import subprocess
import sys

PROJECT_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)
BACKEND_ROOT = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


def _fresh_bridge_without_webview(monkeypatch):
    """在 sys.modules 屏蔽 webview 后重新导入 bridge 包，返回 file_bridge 模块。"""
    monkeypatch.setitem(sys.modules, "webview", None)
    for name in [
        n
        for n in list(sys.modules)
        if n == "bridge" or n.startswith("bridge.")
    ]:
        monkeypatch.delitem(sys.modules, name, raising=False)
    from bridge import file_bridge as fb

    return fb


class TestNoWebviewInSources:
    def test_backend_sources_have_no_webview_import(self):
        """backend/main.py 与 backend/bridge/*.py 不得出现 webview import。"""
        offenders = []
        sources = [
            os.path.join(BACKEND_ROOT, "main.py"),
            *sorted(map(str, (pathlib.Path(BACKEND_ROOT) / "bridge").glob("*.py"))),
        ]
        for source in sources:
            for lineno, line in enumerate(
                pathlib.Path(source).read_text(encoding="utf-8").splitlines(), 1
            ):
                stripped = line.strip()
                if stripped.startswith("import webview") or stripped.startswith(
                    "from webview"
                ):
                    offenders.append(f"{os.path.basename(source)}:{lineno}: {stripped}")
        assert offenders == [], f"webview import 残留: {offenders}"

    def test_main_importable_with_webview_blocked(self):
        """sys.modules 屏蔽 webview 后，独立进程 import main 必须成功。"""
        code = (
            "import sys; sys.path.insert(0, 'backend');"
            "sys.modules['webview'] = None;"
            "import main; print('import-ok')"
        )
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
        )
        assert result.returncode == 0, (
            f"无 webview 环境 import main 失败:\n{result.stderr}"
        )
        assert "import-ok" in result.stdout


class TestProbeEndpointWithoutWebview:
    def test_has_native_dialogs_false_without_webview(self, monkeypatch):
        """屏蔽 webview 后启动 TestClient，探测端点恒为 False。"""
        monkeypatch.setitem(sys.modules, "webview", None)
        for name in [
            n
            for n in list(sys.modules)
            if n == "main" or n == "bridge" or n.startswith("bridge.")
        ]:
            monkeypatch.delitem(sys.modules, name, raising=False)
        from fastapi.testclient import TestClient

        import main

        client = TestClient(main.app)
        response = client.get("/api/has_native_dialogs")
        assert response.status_code == 200
        assert response.json() is False


class TestSlotDegradation:
    def test_select_without_window_and_tkinter_returns_empty(self, monkeypatch):
        """无窗口对象且无 tkinter：select_files → '[]'，select_folder → ''，不抛异常。"""
        fb = _fresh_bridge_without_webview(monkeypatch)
        bridge_instance = fb.FileBridge()
        monkeypatch.delattr(bridge_instance, "window", raising=False)
        monkeypatch.setattr(fb, "tk", None)
        monkeypatch.setattr(fb, "filedialog", None)
        assert bridge_instance.select_files() == "[]"
        assert bridge_instance.select_folder() == ""


class TestSlotInjection:
    def test_injected_window_drives_file_dialogs(self, monkeypatch):
        """注入鸭子类型窗口对象后，选择走其 create_file_dialog（0=OPEN, 1=FOLDER）。"""
        fb = _fresh_bridge_without_webview(monkeypatch)
        bridge_instance = fb.FileBridge()

        calls = []

        def fake_dialog(kind, allow_multiple=False, file_types=None):
            calls.append(
                {"kind": kind, "allow_multiple": allow_multiple, "file_types": file_types}
            )
            if kind == 1:
                return ["/tmp/chosen-dir"]
            return ["/tmp/a.log", "/tmp/b.log"]

        bridge_instance.window = type("FakeShellWindow", (), {})()
        bridge_instance.window.create_file_dialog = fake_dialog

        assert json.loads(bridge_instance.select_files()) == ["/tmp/a.log", "/tmp/b.log"]
        assert calls[-1]["kind"] == 0
        assert calls[-1]["allow_multiple"] is True

        assert bridge_instance.select_folder() == "/tmp/chosen-dir"
        assert calls[-1]["kind"] == 1
