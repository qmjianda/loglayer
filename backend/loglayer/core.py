
from typing import Dict, Optional
from dataclasses import dataclass
from .ui import Component

@dataclass
class ProcessedLine:
    """处理后的行信息，包含内容和坐标映射"""
    content: str
    # 偏移量映射表 (可选): 用于处理高亮错位。
    # 格式: {new_pos: old_pos}
    offset_map: Optional[Dict[int, int]] = None

class LayerCategory:
    """图层分类：处理层 vs 渲染层"""
    FILTERING = "filtering"      # 过滤层: 决定可见性 (只读内容)
    TRANSFORM = "transform"      # 转换层: 修改内容 (如脱敏、替换)
    RENDERING = "rendering"      # 渲染层: 增加装饰 (如高亮、样式)

class LayerStage:
    """图层执行阶段"""
    NATIVE = "native"  # 使用 ripgrep 执行 (极速)
    LOGIC = "logic"    # 使用 Python 执行 (灵活)

def derive_engine(category: str, stage: str) -> str:
    """图层类别即执行位置（协议 v2）：渲染层 → frontend，native 阶段 → native，其余 → logic。
    图层不得自行声明执行位置，engine 一律由此派生。"""
    if category == LayerCategory.RENDERING:
        return "frontend"
    if stage == LayerStage.NATIVE:
        return "native"
    return "logic"

# ============================================================
# 1. 过滤层 (Filtering Layer) - 仅决定可见性
# ============================================================

class FilterLayer(Component):
    """
    过滤图层基类。
    职责：决定一行日志是否应该被保留。
    """
    category = LayerCategory.FILTERING
    stage = LayerStage.LOGIC
    icon = "filter"

    def filter_line(self, content: str, index: int = -1) -> bool:
        """返回 True: 保留; 返回 False: 丢弃"""
        return True

    def process_line(self, content: str) -> str:
        """过滤层默认不改写内容；管线对 logic 层统一调用该方法"""
        return content

    def reset(self):
        pass

class NativeFilterLayer(FilterLayer):
    """高性能原生过滤层 (ripgrep)"""
    stage = LayerStage.NATIVE

    def get_rg_args(self) -> list:
        return []

# ============================================================
# 2. 转换层 (Transformation Layer) - 修改内容
# ============================================================

class TransformLayer(Component):
    """
    转换图层基类。
    职责：修改日志内容 (脱敏、格式化等)。
    """
    category = LayerCategory.TRANSFORM
    icon = "replace"

    def process_line(self, content: str) -> ProcessedLine:
        """返回处理后的对象"""
        return ProcessedLine(content=content)

# ============================================================
# 3. 渲染层 (Rendering Layer) - 视觉装饰
# ============================================================

class RenderingLayer(Component):
    """
    渲染增强层基类。
    职责：不改变内容，仅提供装饰信息。视觉计算在前端静态 renderer 完成，
    后端仅保存其元数据，不执行 highlight_line/get_row_style。
    """
    category = LayerCategory.RENDERING
    icon = "highlight"

    def highlight_line(self, content: str) -> list:
        """返回高亮区域列表"""
        return []

    def get_row_style(self, content: str) -> dict:
        """返回整行样式"""
        return {}
