# Tasks: LogViewer 预加载优化

## 1. 调整 constants.ts 配置

- [x] 1.1 将 BUFFER_NORMAL 从 200 改为 800
- [x] 1.2 将 BUFFER_LARGE 从 500 改为 1500
- [x] 1.3 将 FETCH_DEBOUNCE_MS 从 10 改为 50

## 2. 优化 LogViewer.tsx 动态 buffer

- [x] 2.1 将 velocity 乘数从 50 改为 200
- [x] 2.2 添加滚动方向检测，前向滚动时增加额外 buffer

## 3. 验证

- [x] 3.1 运行 TypeScript 类型检查
- [ ] 3.2 测试快速滚动确保无空白加载
