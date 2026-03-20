# LayerEngine Module

> 图层处理引擎 - 多阶段流水线架构

---

## 概述

LayerEngine 是 LogLayer 的后端处理核心，采用三阶段五类别的流水线架构处理日志。

---

## 执行阶段

| 阶段 | 描述 | 性能 |
|------|------|------|
| **NATIVE** | ripgrep 并行处理 | 最快 |
| **LOGIC** | Python 单/多线程处理 | 中等 |
| **RENDERING** | 轻量级视觉刷新 | 最快 |

---

## 图层类别

| 类别 | 功能 | 阶段 |
|------|------|------|
| **FILTER** | 行级过滤 | NATIVE/LOGIC |
| **TRANSFORM** | 内容修改 | LOGIC |
| **HIGHLIGHT** | 文本级高亮 | RENDERING |
| **DECORATION** | 行级样式 | RENDERING |
| **WIDGET** | 独立 UI 组件 | RENDERING |

---

## 基类结构

```python
class Layer(ABC):
    type_id: str           # 唯一标识
    display_name: str      # 显示名称
    description: str       # 描述
    icon: str              # 图标
    category: LayerCategory
    stage: LayerStage
    is_builtin: bool = True
    inputs: List[Any] = [] # UI 输入定义
    
    @abstractmethod
    def process(self, context: PipelineContext) -> LayerResult:
        pass
```

---

## 处理流程

```
前端 sync_layers()
       ↓
JSON 解析为 LogLayer[]
       ↓
按 stage 分组
       ↓
NATIVE 阶段 (ripgrep)
       ↓
LOGIC 阶段 (Python)
       ↓
RENDERING 阶段
       ↓
返回处理结果
```

---

## PipelineContext

```python
@dataclass
class PipelineContext:
    file_path: str
    line_offsets: List[int]
    visible_indices: List[int]
    line_count: int
    filter_cache: Dict[str, Set[int]]
    transform_cache: Dict[int, str]
    highlight_cache: Dict[int, List[Highlight]]
    decoration_cache: Dict[int, RowStyle]
```

---

## 内置图层

| 图层 | 类型 | 功能 |
|------|------|------|
| QueryFilter | FILTER | KQL 查询过滤 |
| Highlight | HIGHLIGHT | 文本高亮 |
| LevelFilter | FILTER | 日志级别过滤 |
| TimeFilter | FILTER | 时间范围过滤 |
| LabelLayer | FILTER | 标签提取过滤 |
| BookmarkLayer | DECORATION | 书签显示 |
| ReplaceLayer | TRANSFORM | 文本替换 |
| TimelineLayer | WIDGET | 时间线直方图 |

---

## 相关文件

- `backend/loglayer/core.py` - 基类定义
- `backend/loglayer/registry.py` - 图层注册
- `backend/loglayer/builtin/` - 内置图层
- `backend/pipeline_mixin.py` - 流水线执行