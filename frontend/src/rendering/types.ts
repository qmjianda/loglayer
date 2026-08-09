// 渲染层共享契约（图层协议 v2，D5 设计）
// 渲染函数为纯函数：输出仅由 (content, config) 决定，无副作用，可独立测试。

/** 高亮段：content 中的 [start, end) 字符区间 */
export interface HighlightSegment {
  start: number;
  end: number;
  color: string;
  opacity: number;
  /** 搜索匹配标记：true 时按搜索高亮色渲染（当前匹配/其他匹配异色由调用方区分） */
  isSearch: boolean;
}

/** 行级样式 */
export interface RowStyle {
  backgroundColor?: string;
  color?: string;
}

/** 渲染器输出：高亮段列表 + 可选行样式 */
export interface RenderResult {
  segments: HighlightSegment[];
  rowStyle?: RowStyle;
}

/** 渲染器：纯函数，输入文本与配置，输出 segments 与行样式 */
export type Renderer = (content: string, config: unknown) => RenderResult;

/** 图层执行引擎（与后端 LayerCategory/LayerStage 派生一致） */
export type LayerEngine = 'frontend' | 'native' | 'logic';

/** 图层类别（与后端 core.py LayerCategory 字符串值一致） */
export type LayerCategory = 'filtering' | 'transform' | 'rendering';

/** 通用规则引擎的规则配置（配置即图层） */
export interface RuleConfig {
  /** 匹配模式：默认字面量，regex: true 时为正则 */
  pattern: string;
  /** 动作：highlight 产生高亮段，rowTint 整行着色 */
  action: 'highlight' | 'rowTint';
  color: string;
  opacity?: number;
  /** 标记为搜索匹配（供当前/其他匹配异色复用） */
  isSearch?: boolean;
  /** 正则标志（如 'i'）；缺省时大小写不敏感 */
  flags?: string;
  regex?: boolean;
}
