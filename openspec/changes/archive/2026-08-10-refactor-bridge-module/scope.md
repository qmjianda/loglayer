# Scope: refactor-bridge-module

## 新增

- backend/bridge/                            # 拆分出的子模块目录
- backend/bridge/__init__.py

## 修改

- backend/bridge.py                         # 瘦身为门面
- backend/main.py                           # 导入路径
- backend/search_mixin.py                   # 导入路径
- AGENTS.md                                 # 架构地图更新

## 删除

- （无）
