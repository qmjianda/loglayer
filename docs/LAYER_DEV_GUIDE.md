# LogLayer 图层与插件开发指南

> 本文档介绍如何为 LogLayer 添加新的图层或插件。

---

## 目录

1. [架构概述](#架构概述)
2. [图层类型](#图层类型)
3. [创建新图层](#创建新图层)
4. [UI 输入组件](#ui-输入组件)
5. [注册图层](#注册图层)
6. [完整示例](#完整示例)

---

## 架构概述

LogLayer 图层系统分为三类：

```
backend/loglayer/
├── core.py          # 图层基类定义
├── ui.py            # UI 输入组件
├── registry.py      # 图层注册表
└── builtin/         # 内置图层
    ├── filter.py    # 过滤图层
    ├── level.py     # 等级图层
    ├── highlight.py # 高亮图层
    └── ...
```

---

## 图层类型

### 1. 过滤层 (FilterLayer)
- **职责**: 决定日志行是否可见
- **基类**: `FilterLayer` 或 `NativeFilterLayer` (使用 ripgrep)
- **方法**: `filter_line(content, index) -> bool`

### 2. 转换层 (TransformLayer)
- **职责**: 修改日志内容
- **基类**: `TransformLayer`
- **方法**: `process_line(content) -> ProcessedLine`

### 3. 渲染层 (RenderingLayer)
- **职责**: 添加视觉装饰（高亮、颜色等）
- **基类**: `RenderingLayer`
- **方法**: 
  - `highlight_line(content) -> list` - 高亮区域
  - `get_row_style(content) -> dict` - 整行样式

### 4. 原生处理层 (NativeProcessingLayer)
- **职责**: 使用 ripgrep 进行高性能过滤
- **基类**: `NativeProcessingLayer`
- **方法**: `get_rg_args() -> list`

---

## 创建新图层

### 步骤 1: 创建图层文件

在 `backend/loglayer/builtin/` 目录下创建新文件，例如 `mylayer.py`:

```python
from loglayer.ui import StrInput, BoolInput
from loglayer.core import NativeProcessingLayer

class MyLayer(NativeProcessingLayer):
    """我的自定义图层"""
    display_name = "我的图层"
    description = "这是一个自定义过滤图层"
    icon = "filter"  # 可选: 用于 UI 显示的图标
    
    # 定义配置表单
    inputs = [
        StrInput("pattern", "匹配模式", value=""),
        BoolInput("caseSensitive", "大小写敏感", value=False)
    ]
    
    def get_rg_args(self):
        if not self.pattern:
            return []
        args = []
        if not self.caseSensitive:
            args.append("-i")
        args.extend(["-e", self.pattern])
        return args
```

### 步骤 2: 注册图层

编辑 `backend/loglayer/registry.py`:

```python
# 在文件顶部导入
from loglayer.builtin.mylayer import MyLayer

# 在 LayerRegistry.__init__ 中注册
self.register_builtin("MY_LAYER", MyLayer)
```

---

## UI 输入组件

| 组件 | 用途 | 示例 |
|------|------|------|
| `StrInput` | 文本输入 | `StrInput("pattern", "匹配模式", value="")` |
| `IntInput` | 整数输入 | `IntInput("count", "数量", value=10)` |
| `BoolInput` | 开关 | `BoolInput("enabled", "启用", value=True)` |
| `RangeInput` | 滑动条 | `RangeInput("opacity", "透明度", min=0, max=100, value=50)` |
| `DropdownInput` | 下拉选择 | `DropdownInput("level", "等级", options=["INFO", "WARN", "ERROR"])` |
| `MultiSelectInput` | 多选 | `MultiSelectInput("levels", "等级", options=["INFO", "WARN"], value=["INFO"])` |
| `SearchInput` | 搜索框 | `SearchInput("query", "搜索", regex=True, caseSensitive=False)` |
| `ColorInput` | 颜色选择 | `ColorInput("color", "高亮颜色", value="#ff0000")` |

### SearchInput 特殊属性

```python
SearchInput(
    name="query",
    display_name="搜索内容",
    value="",              # 默认值
    regex=False,           # 是否支持正则
    caseSensitive=False,   # 是否大小写敏感
    wholeWord=False,      # 是否全词匹配
    info="提示信息"        # 鼠标悬停提示
)
```

---

## 完整示例

### 示例 1: 过滤图层 (使用 ripgrep)

```python
# backend/loglayer/builtin/keyword_filter.py
from loglayer.ui import MultiSelectInput
from loglayer.core import NativeProcessingLayer

class KeywordFilterLayer(NativeProcessingLayer):
    """关键词过滤图层"""
    display_name = "关键词过滤"
    description = "按关键词过滤日志"
    icon = "filter"
    
    inputs = [
        MultiSelectInput(
            "keywords",
            "排除关键词",
            options=["DEBUG", "TRACE", "VERBOSE"],
            value=[]
        )
    ]
    
    def get_rg_args(self):
        if not self.keywords:
            return []
        # 使用 ripgrep 的 -v (反向) 和 -e (模式) 实现排除
        pattern = "|".join(self.keywords)
        return ["-v", "-e", pattern]
```

### 示例 2: 渲染图层 (高亮)

```python
# backend/loglayer/builtin/error_highlight.py
import re
from loglayer.ui import ColorInput
from loglayer.core import RenderingLayer

class ErrorHighlightLayer(RenderingLayer):
    """错误高亮图层"""
    display_name = "错误高亮"
    description = "高亮显示错误日志"
    icon = "highlight"
    
    inputs = [
        ColorInput("errorColor", "错误颜色", value="#ff4444"),
        ColorInput("warnColor", "警告颜色", value="#ffaa00")
    ]
    
    def highlight_line(self, content):
        """返回高亮区域列表"""
        highlights = []
        
        # 高亮 ERROR
        for match in re.finditer(r'\bERROR\b', content, re.IGNORECASE):
            highlights.append({
                "start": match.start(),
                "end": match.end(),
                "color": self.errorColor,
                "bold": True
            })
        
        # 高亮 WARN
        for match in re.finditer(r'\bWARN\b', content, re.IGNORECASE):
            highlights.append({
                "start": match.start(),
                "end": match.end(),
                "color": self.warnColor,
                "bold": False
            })
        
        return highlights
```

### 示例 3: 转换图层 (脱敏)

```python
# backend/loglayer/builtin/mask_transform.py
import re
from loglayer.ui import BoolInput
from loglayer.core import TransformLayer, ProcessedLine

class MaskTransformLayer(TransformLayer):
    """数据脱敏图层"""
    display_name = "数据脱敏"
    description = "脱敏手机号、邮箱等敏感信息"
    icon = "replace"
    
    inputs = [
        BoolInput("maskPhone", "脱敏手机号", value=True),
        BoolInput("maskEmail", "脱敏邮箱", value=True)
    ]
    
    def process_line(self, content):
        masked = content
        
        if self.maskPhone:
            # 脱敏手机号: 138****1234
            masked = re.sub(r'1[3-9]\d(\d{4})(\d{4})', r'1***\1\2', masked)
        
        if self.maskEmail:
            # 脱敏邮箱: t***@example.com
            masked = re.sub(r'(\w)(\w+)@', r'\1***@', masked)
        
        return ProcessedLine(content=masked)
```

---

## 调试技巧

1. **查看所有可用图层**: 访问 `/api/layers/registry` API
2. **日志输出**: 使用 `print()` 在图层方法中添加调试信息
3. **测试 ripgrep**: 在命令行手动测试 `rg` 参数

```bash
# 测试 ripgrep 参数
rg -i -e "ERROR" -v test.log
```

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `backend/loglayer/core.py` | 图层基类定义 |
| `backend/loglayer/ui.py` | UI 组件定义 |
| `backend/loglayer/registry.py` | 图层注册逻辑 |
| `frontend/src/components/LayersPanel.tsx` | 图层管理 UI |
