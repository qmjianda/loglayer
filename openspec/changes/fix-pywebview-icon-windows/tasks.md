# Tasks: fix-pywebview-icon-windows

## 1. Backend

- [x] 1.1 `backend/bridge/utils.py`: 新增 `select_window_icon(icon_path)` 纯函数
- [x] 1.2 `backend/main.py`: `webview.start(icon=...)` 改用 `select_window_icon()`

## 2. Tests

- [x] 2.1 `tests/unit/test_window_icon.py`: Windows + png → None
- [x] 2.2 `tests/unit/test_window_icon.py`: Windows + ico → 返回路径
- [x] 2.3 `tests/unit/test_window_icon.py`: 非 Windows + png → 返回路径
- [x] 2.4 `tests/unit/test_window_icon.py`: 路径不存在 → None
