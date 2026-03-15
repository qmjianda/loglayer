# LogLayer 命令速查表

> 常用命令快速参考

---

## 开发

```bash
# 启动前端
cd frontend && npm run dev          # port 3000

# 启动后端
python backend/main.py              # 完整应用

# 同时启动 (需两个终端)
npm run dev & python backend/main.py
```

---

## 测试

```bash
# Python 测试
pytest tests/                      # 全部测试
pytest tests/unit/                # 单元测试
pytest tests/integration/         # 集成测试
pytest tests/test_name.py -v      # 单个文件

# TypeScript 检查
cd frontend && npx tsc --noEmit   # 类型检查
npm run test                      # Vitest
```

---

## 构建

```bash
# 前端构建
cd frontend && npm run build

# 打包离线版本
python tools/package_offline.py         # 源码包
python tools/package_offline.py --exe   # 独立可执行文件

# 清理
cd frontend && rm -rf dist node_modules
```

---

## OpenSpec

```bash
# 查看变更
openspec list
openspec list --json

# 创建变更
openspec new <name>

# 继续变更
openspec continue

# 验证变更
openspec verify

# 归档变更
openspec archive
```

---

## Git

```bash
# 快速提交
git add . && git commit -m "message"

# 查看状态
git status
git log --oneline -10
```

---

## 快捷别名 (推荐添加到 ~/.bashrc)

```bash
alias lldev='cd /path/to/loglayer && npm run dev'
alias llback='cd /path/to/loglayer && python backend/main.py'
alias lltest='cd /path/to/loglayer && pytest tests/'
alias llbuild='cd /path/to/loglayer/frontend && npm run build'
```

*2026-03-14*
