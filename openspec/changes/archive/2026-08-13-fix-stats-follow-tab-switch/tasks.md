# Tasks: fix-stats-follow-tab-switch

## 1. Frontend

- [x] 1.1 `frontend/src/App.tsx`: `useEffect` 监听 activeFileId，已加载文件切换时重新拉取统计

## 2. Tests

- [x] 2.1 `tests/e2e/test_right_inspector_panel.py`: 切 tab 后级别统计随激活文件切换（WARN/INFO）
