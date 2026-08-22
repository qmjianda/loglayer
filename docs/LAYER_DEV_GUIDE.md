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
7. [插件系统](#插件系统)
8. [迁移旧图层](#迁移旧图层)
9. [测试与安全边界](#测试与安全边界)

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

## 插件系统

插件系统用于把后端 Python 图层和配置扩展为可安装的外部包。插件由
`plugin_contract.py` 定义契约，由 `plugin_discovery.py` 发现，由
`plugin_loader.py` 加载，并通过 `plugin_hooks.py` 接入应用生命周期。插件
注册表通过 `RegistryFacade` 对外提供统一入口。插件使用 Pluggy hook，入口点
组名固定为 `loglayer.plugins`。

### 能力边界

插件的处理能力必须明确归类，不要把后端处理和前端视觉混在一起：

| 类型 | 运行位置 | 用途 | 典型接口 |
|------|----------|------|----------|
| `FILTER` | 后端流水线 | 决定日志行是否保留 | `filter_line(content, index) -> bool` |
| `TRANSFORM` | 后端流水线 | 修改日志内容或结构 | `process_line(content) -> ProcessedLine` |
| `RENDERING` | 前端静态渲染器 | 计算高亮片段、行样式或等级 | 渲染器注册表中的 renderer |
| `UIWidget` | 固定前端插槽 | 提供受支持的配置或操作界面 | `sidebar`、`inspector`、`statusbar`、`editor_toolbar` |

`FILTER` 和 `TRANSFORM` 可以通过插件进入后端处理流水线。`RENDERING` 不会
加载任意 React 代码，而是由前端已有的静态 renderer 根据插件声明的配置计算
`segments` 或 `rowStyle`。`UIWidget` 只能挂载到固定 UI 插槽，不能创建任意
路由、替换页面或注入未知组件。当前系统不承诺任意前端插件、远程 React 加载
或沙箱隔离。

### manifest

外部插件包必须在包根目录提供 `loglayer.plugin.json`。manifest 只描述身份、
版本、能力和入口点，不应把可执行代码写进 JSON：

```json
{
  "id": "acme.error-filter",
  "name": "错误过滤器",
  "version": "1.0.0",
  "description": "按错误级别筛选日志",
  "api_version": "1",
  "capabilities": ["FILTER", "UIWidget"],
  "ui_slots": ["inspector"],
  "config_schema": {
    "level": {"type": "string", "default": "ERROR"}
  }
}
```

`id` 必须稳定且全局唯一，`version` 使用可比较的版本号。声明
`RENDERING` 时应引用系统已有的 renderer 类型和可序列化配置，不得声明任意
JavaScript 文件。`ui_slots` 只能使用 `sidebar`、`inspector`、`statusbar`、
`editor_toolbar`。

### Python 插件与 entry point

Python 包通过 `pyproject.toml` 注册 `loglayer.plugins` entry point。entry point
指向实现 `plugin_hooks.py` 所需 hook 的模块或插件类：

```toml
[project.entry-points."loglayer.plugins"]
error_filter = "acme_loglayer_plugin:plugin"
```

一个最小插件可以实现 `FILTER`，并通过 `RegistryFacade` 注册自己的图层：

```python
from loglayer.core import NativeProcessingLayer
from loglayer.registry import RegistryFacade
from loglayer.ui import DropdownInput


class ErrorFilterLayer(NativeProcessingLayer):
    display_name = "错误过滤器"
    description = "只保留指定级别的日志"
    inputs = [DropdownInput("level", "级别", options=["ERROR", "WARN"])]

    def get_rg_args(self) -> list[str]:
        return ["-e", rf"\\b{self.level}\\b"]


def plugin(manager) -> None:
    RegistryFacade(manager).register("ACME_ERROR_FILTER", ErrorFilterLayer)
```

实际插件应按 `plugin_contract.py` 中的契约创建 manifest 对应的对象，并按
`plugin_hooks.py` 提供的 hook 进行注册。不要直接修改全局注册表或绕过
`RegistryFacade`。`plugin_discovery.py` 负责读取 manifest 和 entry point，
`plugin_loader.py` 负责校验后加载。加载失败时应保留应用主体可用，并报告插件
ID、版本和失败原因。

### 外部插件安装流程

1. 在插件项目中生成 `loglayer.plugin.json`、Python 模块、`pyproject.toml` 和测试。
2. 构建 wheel，或在开发环境使用 `pip install -e .` 安装。
3. 确认目标 LogLayer 与 `api_version` 兼容，再把插件安装到同一个 Python 环境。
4. 重启 LogLayer，让 `plugin_discovery.py` 重新扫描 `loglayer.plugins`。
5. 在图层注册表和对应固定 UI 插槽中检查插件是否出现。

源码包安装示例：

```bash
python -m pip install ./dist/acme_loglayer_plugin-1.0.0-py3-none-any.whl
```

开发安装示例：

```bash
python -m pip install -e ./acme-loglayer-plugin
```

### EXE 安装

Frozen EXE 仍然在应用进程内运行 Python 插件。插件不能假定用户能修改 EXE
内部文件，也不能把插件 wheel 复制到任意目录后期待自动发现。发布插件时应
提供与 EXE 版本匹配的安装说明，并使用应用支持的插件目录或安装器入口。若
当前 EXE 版本没有外部插件目录配置，应发布包含插件的新版 EXE，而不是指导
用户替换打包文件。

---

## 迁移旧图层

旧版内置图层通常直接导入 `LayerRegistry` 并调用 `register_builtin`。迁移时：

1. 保留原图层的 `FILTER` 或 `TRANSFORM` 行为，不要在迁移中改变匹配语义。
2. 为插件补充稳定 `id`、`version`、`api_version` 和 `loglayer.plugin.json`。
3. 把直接注册改为插件 hook，通过 `RegistryFacade` 注册。
4. 如果旧图层包含高亮或行颜色，把它拆成前端已有 `RENDERING` renderer 能理解
   的声明和配置，不要把 React 组件放进 Python 插件。
5. 如果旧图层有配置面板，把面板映射到 `inspector` 或其他固定 `UIWidget` 插槽。
6. 为旧配置提供兼容的字段默认值，并为旧 ID 到新 ID 的映射添加迁移测试。

旧图层仍是内置图层时，不需要为了使用插件系统强行拆包。只有需要独立发布、
独立安装或第三方维护时才应迁移为外部插件。

---

## 测试与安全边界

插件至少应覆盖以下测试：

```bash
python -m pytest tests/unit/test_plugin_contract.py
python -m pytest tests/unit/test_plugin_discovery.py
python -m pytest tests/unit/test_plugin_loader.py
```

插件自己的测试还应验证 manifest 校验、entry point 发现、重复 ID、版本不兼容、
加载失败隔离、FILTER 或 TRANSFORM 的实际输出，以及允许的 UI 插槽。涉及前端
静态 renderer 的能力，应测试配置到 `segments` 或 `rowStyle` 的映射，而不是
测试动态加载 React 模块。

外部插件是受信任的进程内 Python 代码。插件可以访问应用进程拥有的文件、网络、
环境变量和其他 Python 能力，manifest、Pluggy 或 EXE 打包都不会提供安全沙箱。
安装前必须审核来源、依赖和代码权限。不要在文档、manifest 或 AI 生成结果中
承诺沙箱、权限隔离或安全执行；需要不信任代码隔离时，应使用独立进程或操作系统
级别的隔离方案，并另行设计和验证。

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `backend/loglayer/core.py` | 图层基类定义 |
| `backend/loglayer/ui.py` | UI 组件定义 |
| `backend/loglayer/registry.py` | 图层注册逻辑 |
| `frontend/src/components/LayersPanel.tsx` | 图层管理 UI |
| `backend/loglayer/plugin_contract.py` | 插件 manifest 与能力契约 |
| `backend/loglayer/plugin_discovery.py` | manifest 和 entry point 发现 |
| `backend/loglayer/plugin_hooks.py` | Pluggy hook 定义 |
| `backend/loglayer/plugin_loader.py` | 插件校验与加载 |
| `backend/loglayer/registry.py` | `RegistryFacade` 和图层注册 |
