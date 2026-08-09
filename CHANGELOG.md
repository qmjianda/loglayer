# Changelog

本仓库采用 Conventional Commits 风格提交前缀（Feat:/Fix:/Perf:/Refactor:/Docs: 等），
由 git-cliff 自动生成。版本号与 package.json / backend/__init__.py 手工同步。

## [unreleased]

### 🚀 Features

- Implement UnifiedPanel, update styling with TailwindCSS, and refactor log processors
- Unified backend-first architecture with multi-session support and bug fixes
- Add file loading skeleton UI and remove default layer preset
- Optimized startup handshake, added premium app icon, and polished UI/UX
- Refactor Explorer UI and enhance FileTree functionality
- 优化已打开文件和图层面板UI交互
- Implement workspace session persistence and update user manual
- Add Qt compatibility layer, support PyInstaller standalone EXE, and fix session restoration bugs
- Implement unified python-driven layer system and robust drag-and-drop hierarchy management
- Add TimeRange layer and fix UI expansion logic
- Implement Nearest Next search navigation and fix UI search issues
- Layer decoupling architecture - Processing vs Rendering layers
- Implement bookmark enhancements and system-managed layer architecture
- Implement custom context menu in LogViewer
- *(bookmark)* Enhance bookmark functionality
- Deep integrate bookmarks into layer system and fix UX issues
- 完善设置系统、命令面板和响应式布局
- 完善主题系统和组件架构统一
- 实现 OpenSpec change - 主题完善和性能监控
- 集成性能监控到 StatusBar
- 完成 OpenSpec change - 主题、性能监控和搜索
- 完成主题系统、过渡动画和可访问性优化
- 实现 AI 助手功能 - 时间戳检测、时间范围建议、聊天面板
- 实现SQL查询解析器、JSON树视图、日志统计面板基础组件
- 添加统计面板到侧边栏视图
- 添加文件监视功能和API
- 集成文件监视功能到App
- 文件监视自动滚动到新内容
- 添加日志统计计算hook
- LogViewer 右键菜单添加 JSON 展开功能
- StatusBar 添加文件监视状态指示器
- LogViewer 添加新内容提示按钮
- Add real AI connection test and OpenAI custom URL support
- Add real log level statistics with backend calculation
- Add --host parameter for external access
- VFS-SQLite 索引缓存 + LRU 淘汰 + wasOpen 历史持久化
- LogViewer DOM 虚拟化重构 + 工作区持久化 + 分屏滚动位置保持

### 🐛 Bug Fixes

- Highlight layer stacking and stats synchronization
- Stop drag event propagation to fix DND UI
- Browser mode file dialogs and frontend cleanup
- Ripgrep hyphen query bug and update project map
- Packaging bugs and remove build/ from tracking
- *(bridge)* Preserve system-managed layers during sync
- Improve search navigation and counter (Ctrl+F)
- LogViewer selection rendering, Ctrl+F auto-fill, and bookmark preview loading
- 修复书签和菜单Bug
- 使用React Portal修复鼠标穿透问题
- 修复LogViewer滚动性能问题
- 修复虚拟滚动时底部出现空白背景的问题
- 优化 LogViewer 预加载 buffer，提升快速滚动体验
- 修复快速滚动时黑色闪屏问题，统一容器和canvas背景色
- 统一主题配色，将 bg-dark-2 替换为 bg-theme-base/bg-theme-surface
- 添加 Windows 到 Linux 路径转换逻辑，解决跨平台文件打开问题
- Platform-aware path conversion for Windows/Linux compatibility
- Use Path for cross-platform path resolution
- Move Perf button away from StatusBar and prevent bookmark trigger
- Handle partial indexing correctly in frontend
- Use file path instead of mmap for multiprocessing (pickle error)
- Use camelCase lineCount for frontend compatibility
- Address critical bugs from deep analysis report
- 书签锚定物理行号 + 双行号 gutter（修复过滤视图下书签跳转错位）

### 💼 Other

- Reorganize project structure and consolidate logs
- Use simple efficient single-threaded indexing

### 🚜 Refactor

- Cleanup unused processors and optimize backend imports
- Extract search and bookmark logic to mixins and hooks, optimize LogViewer performance, and fix regressions
- Unify refresh logic, implement layered caching, split SearchMixin
- Unify skills to .agents directory, remove duplicates
- Remove PyQt6 dependencies, migrate tests to threading
- 提取公共工具函数，删除未使用组件
- 完善主题系统，添加更多 CSS 变量
- 替换更多硬编码颜色为主题变量
- 替换 EditorGoToLineWidget 硬编码颜色
- 替换 CommandPalette, KeyboardShortcutsPanel 硬编码颜色
- 替换 SearchPanel 硬编码颜色为主题变量
- 替换 EditorFindWidget 硬编码颜色
- 替换 BookmarkPopover 硬编码颜色
- 完善主题变量替换，添加 requests 依赖
- 完善AI配置界面，修复API URL问题，添加AI侧边栏视图
- 重构主题系统，建立统一的配色架构
- Frontend architecture optimization
- Docs-restructure — AGENTS.md 为唯一会话入口，移除状态文档，归档 opsx 变更

### 📚 Documentation

- 完善代码中文注释并新增开发者学习指南 (LEARNING_PATH)
- Update PROJECT_MAP.md with Phase 5 optimization details
- 更新 PROGRESS.md 记录新功能

### ⚡ Performance

- Optimize indexing and pipeline; fix loading hang
- Lazy indexing for instant file display
- Multi-process parallel indexing for large files
- Add fast preview mode for instant content display

### 🧪 Testing

- Consolidate backend core tests and cleanup temporary scripts
- Complete Phase 6 Automated Testing Enhancement with pytest suite

### ⚙️ Miscellaneous Tasks

- Ignore python bytecode files and cleanup index
- Archive state before optimization (2026-02-07)
- 创建 OpenSpec change - add-log-analysis-features
- 更新任务进度
- 更新任务进度
- 归档 OpenSpec change - add-log-analysis-features
