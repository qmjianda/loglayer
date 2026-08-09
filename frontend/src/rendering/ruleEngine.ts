// 通用规则引擎（图层协议 v2，design D5）
// 规则配置 { pattern, action, color } → segments/rowStyle；配置即图层，90% 视觉需求零代码。
// 纯函数、无副作用；单条规则异常仅降级该规则，不影响其余规则与调用方。
import { HighlightSegment, Renderer, RenderResult, RuleConfig } from './types';

/** 字面量转义为正则（非 regex 规则时使用） */
function escapeLiteral(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 构造匹配正则：默认大小写不敏感（缺省 flags='i'），regex 规则透传 pattern；matchAll 需要 g 标志 */
function buildMatcher(rule: RuleConfig, withGlobal = true): RegExp {
  const baseFlags = rule.flags ?? 'i';
  const flags = withGlobal && !baseFlags.includes('g') ? baseFlags + 'g' : baseFlags;
  const source = rule.regex ? rule.pattern : escapeLiteral(rule.pattern);
  return new RegExp(source, flags);
}

/**
 * 应用规则集，聚合高亮段与行样式。
 * - highlight：逐段高亮，每段为 [start, end)
 * - rowTint：匹配则整行着色
 * 单条规则 try/catch 隔离，坏规则（非法正则等）静默跳过。
 */
export function applyRules(content: string, rules: RuleConfig[]): RenderResult {
  const segments: HighlightSegment[] = [];
  let rowStyle: RenderResult['rowStyle'];
  for (const rule of rules) {
    try {
      if (rule.action === 'rowTint') {
        // 匹配判定用无全局标志的正则，避免 lastIndex 状态残留
        const re = buildMatcher(rule, false);
        if (re.test(content)) {
          rowStyle = { ...(rowStyle ?? {}), backgroundColor: rule.color };
        }
      } else {
        const re = buildMatcher(rule);
        for (const m of content.matchAll(re)) {
          if (m.index === undefined || m[0].length === 0) continue;
          segments.push({
            start: m.index,
            end: m.index + m[0].length,
            color: rule.color,
            opacity: rule.opacity ?? 100,
            isSearch: rule.isSearch ?? false,
          });
        }
      }
    } catch {
      // 单条规则降级为不生效，不影响其他规则
    }
  }
  return { segments, rowStyle };
}

/** 配置即图层：将规则集封装为渲染器（可注册进渲染器注册表） */
export function createRuleLayer(rules: RuleConfig[]): Renderer {
  return (content: string): RenderResult => applyRules(content, rules);
}
