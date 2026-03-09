## Why

当前的图层系统存在严重的代码断裂问题：
1. `core.py` 定义的基类与实际使用的类名不一致 (`NativeProcessingLayer`, `DataProcessingLayer` 不存在)
2. 图层分类不清晰，FILTER/TRANSFORM/RENDERING 混合在一起
3. 所有图层都参与 Pipeline 执行，没有区分轻重缓急
4. 缺少独立的 Widget 概念，时间线、标签面板等作为图层实现不合理

需要重新设计图层系统架构，建立清晰的执行阶段和功能分类，以日志处理为核心，实现高性能目标。

## What Changes

1. **修复核心类名断裂** - 统一 `core.py` 定义的基类与实际使用的类
2. **建立三层执行阶段** - NATIVE (ripgrep) / LOGIC (Python) / RENDERING (轻量渲染)
3. **建立五类功能分类** - FILTER / TRANSFORM / HIGHLIGHT / DECORATION / WIDGET
4. **分离 Pipeline 执行** - FILTER+TRANSFORM 走主 Pipeline，HIGHLIGHT+DECORATION 走轻量刷新
5. **独立非图层模块** - Views、Search、Export、AI、FileManagement 独立于图层系统
6. **新增基类定义** - Layer、FilterLayer、NativeFilterLayer、TransformLayer、HighlightLayer、DecorationLayer、Widget
7. **统一 UI Schema** - 修复输入项绑定逻辑

## Capabilities

### New Capabilities
- `layer-system`: 新的图层系统架构，包含完整的基类和执行模型
- `layer-stage`: 执行阶段定义 (NATIVE/LOGIC/RENDERING)
- `layer-category`: 功能分类定义 (FILTER/TRANSFORM/HIGHLIGHT/DECORATION/WIDGET)
- `pipeline-optimization`: 优化 Pipeline 执行的分类处理
- `non-layer-modules`: 独立于图层的功能模块定义

### Modified Capabilities
(无 - 这是全新的架构设计)

## Impact

### 受影响代码
- `backend/loglayer/core.py` - 核心基类定义 (需重写)
- `backend/loglayer/registry.py` - 图层注册表 (修复类引用)
- `backend/loglayer/ui.py` - UI Schema 系统 (优化绑定逻辑)
- `backend/loglayer/builtin/*.py` - 所有内置图层 (更新基类引用)
- `backend/bridge.py` - Pipeline 执行逻辑 (优化分类处理)
- `backend/api_routes.py` - API 端点 (如有必要)

### 新增文件
- `backend/loglayer/stage.py` - 执行阶段定义
- `backend/loglayer/pipeline.py` - Pipeline 执行器

### 架构变更
- 图层现在通过 `category` 和 `stage` 属性区分
- Pipeline 分离为"主 Pipeline"(FILTER+TRANSFORM) 和"轻量刷新"(HIGHLIGHT+DECORATION)
- Widget 不参与 Pipeline，作为独立异步组件

### 性能影响
- NATIVE 滤镜使用 ripgrep 并行处理，最优性能
- RENDERING 层仅刷新缓存，不重算索引
- Widget 异步加载，不阻塞主 Pipeline