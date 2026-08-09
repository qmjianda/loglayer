/**
 * 规则引擎测试（2.11）：applyRules/createRuleLayer 纯函数行为。
 * 覆盖 highlight / rowTint 动作、字面量与 regex 模式、整词匹配、坏规则降级、多规则聚合。
 */
import { describe, it, expect } from 'vitest';
import { applyRules, createRuleLayer } from './ruleEngine';
import type { RuleConfig } from './types';

describe('applyRules - highlight 动作', () => {
  it('字面量模式逐段高亮（默认大小写不敏感）', () => {
    const r = applyRules('ERROR warn ERROR', [
      { pattern: 'ERROR', action: 'highlight', color: '#ff0000' },
    ]);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]).toMatchObject({ start: 0, end: 5, color: '#ff0000', opacity: 100 });
  });

  it('regex 模式按 pattern 匹配', () => {
    const r = applyRules('id=123 id=456', [
      { pattern: 'id=\\d+', action: 'highlight', color: '#0f0', regex: true },
    ]);
    expect(r.segments).toHaveLength(2);
    expect(r.segments.map((s) => s.start)).toEqual([0, 7]);
  });

  it('opacity/isSearch 透传到 segments', () => {
    const r = applyRules('abc', [
      { pattern: 'a', action: 'highlight', color: '#00f', opacity: 50, isSearch: true },
    ]);
    expect(r.segments[0]).toMatchObject({ color: '#00f', opacity: 50, isSearch: true });
  });
});

describe('applyRules - rowTint 动作', () => {
  it('匹配则整行着色', () => {
    const r = applyRules('FATAL crash', [
      { pattern: 'FATAL', action: 'rowTint', color: '#dc2626' },
    ]);
    expect(r.segments).toEqual([]);
    expect(r.rowStyle).toEqual({ backgroundColor: '#dc2626' });
  });

  it('不匹配返回无 rowStyle', () => {
    const r = applyRules('INFO normal', [
      { pattern: 'FATAL', action: 'rowTint', color: '#dc2626' },
    ]);
    expect(r.rowStyle).toBeUndefined();
  });
});

describe('applyRules - 多规则聚合与隔离', () => {
  it('highlight + rowTint 聚合', () => {
    const r = applyRules('ERROR at step 5', [
      { pattern: 'ERROR', action: 'highlight', color: '#ff0000' },
      { pattern: 'step', action: 'rowTint', color: '#00ff00' },
    ]);
    expect(r.segments).toHaveLength(1);
    expect(r.rowStyle).toEqual({ backgroundColor: '#00ff00' });
  });

  it('坏规则（非法正则）静默降级，不影响其他规则', () => {
    const r = applyRules('ERROR here', [
      { pattern: '([unclosed', action: 'highlight', color: '#f00', regex: true },
      { pattern: 'ERROR', action: 'highlight', color: '#0f0' },
    ]);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].color).toBe('#0f0');
  });

  it('空规则集返回空结果', () => {
    const r = applyRules('content', []);
    expect(r.segments).toEqual([]);
    expect(r.rowStyle).toBeUndefined();
  });
});

describe('createRuleLayer - 配置即图层', () => {
  it('封装规则集为渲染器函数', () => {
    const renderer = createRuleLayer([{ pattern: 'TODO', action: 'highlight', color: '#ffa500' }]);
    const r = renderer('has TODO here', {});
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]).toMatchObject({ start: 4, end: 8, color: '#ffa500' });
  });
});
