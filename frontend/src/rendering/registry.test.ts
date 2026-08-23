/**
 * 渲染器快照测试（2.11）：给定 content/config → segments/rowStyle 精确比对。
 * 覆盖 HIGHLIGHT / ROWTINT / LEVEL 内置渲染器、错误隔离降级与 renderLayers 组合。
 */
import { describe, it, expect } from 'vitest';
import {
  renderWithIsolation,
  renderLayers,
  getRenderer,
  registerWidgetRenderer,
  renderWidgetWithIsolation,
  getWidgetRenderer,
} from './registry';
import type { WidgetRenderInput } from '../hooks/usePluginWidgets';
import type { RenderResult } from './types';

const widgetInput: WidgetRenderInput = {
  data: { text: 'healthy' },
  config: {},
  widget: {
    type: 'WIDGET_STATUS',
    plugin_id: 'acme.status',
    display_name: 'Status',
    description: '',
    slot: 'statusbar',
    renderer_id: 'test.metric',
    config: {},
    role: 'statusbar',
    refresh_interval: 0,
  },
};

describe('固定 widget renderer', () => {
  it('unknown renderer degrades locally', () => {
    expect(renderWidgetWithIsolation('missing.renderer', widgetInput)).toBeUndefined();
  });

  it('isolates renderer failures', () => {
    registerWidgetRenderer('test.failure', () => {
      throw new Error('broken');
    });
    expect(renderWidgetWithIsolation('test.failure', widgetInput)).toEqual({});
  });
});

describe('HIGHLIGHT 渲染器', () => {
  it('按 query 字面量匹配产出精确 segments（大小写不敏感）', () => {
    const r = renderWithIsolation('HIGHLIGHT', 'ERROR happened at step 5 ERROR', {
      query: 'ERROR',
      color: '#ff0000',
      opacity: 80,
    });
    expect(r.segments).toEqual([
      { start: 0, end: 5, color: '#ff0000', opacity: 80, isSearch: false },
      { start: 25, end: 30, color: '#ff0000', opacity: 80, isSearch: false },
    ]);
    expect(r.rowStyle).toBeUndefined();
  });

  it('大小写敏感配置生效', () => {
    const r = renderWithIsolation('HIGHLIGHT', 'error ERROR', {
      query: 'error',
      caseSensitive: true,
      color: '#0f0',
    });
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]).toMatchObject({ start: 0, end: 5 });
  });

  it('空 query 返回空 segments（不抛错）', () => {
    const r = renderWithIsolation('HIGHLIGHT', 'content', { query: '' });
    expect(r.segments).toEqual([]);
  });

  it('regex 模式按 pattern 匹配', () => {
    const r = renderWithIsolation('HIGHLIGHT', 'abc123def456', {
      query: '\\d+',
      regex: true,
      color: '#0ff',
    });
    expect(r.segments.map((s) => s.start)).toEqual([3, 9]);
  });

  it('wholeWord 仅匹配完整词', () => {
    const r = renderWithIsolation('HIGHLIGHT', 'cat scatter cat', {
      query: 'cat',
      wholeWord: true,
      color: '#f00',
    });
    // 首尾 cat 匹配，scatter 中的 cat 不匹配
    expect(r.segments).toHaveLength(2);
  });
});

describe('ROWTINT 渲染器', () => {
  it('匹配则整行着色，不产出 segments', () => {
    const r = renderWithIsolation('ROWTINT', 'something ERROR here', {
      query: 'ERROR',
      color: '#00ff00',
    });
    expect(r.segments).toEqual([]);
    expect(r.rowStyle).toEqual({ backgroundColor: '#00ff00' });
  });

  it('不匹配返回空 rowStyle', () => {
    const r = renderWithIsolation('ROWTINT', 'no match here', {
      query: 'MISSING',
      color: '#00ff00',
    });
    expect(r.segments).toEqual([]);
    expect(r.rowStyle).toBeUndefined();
  });
});

describe('LEVEL 渲染器', () => {
  it('默认配色高亮日志级别', () => {
    const r = renderWithIsolation('LEVEL', '2026-01-01 [ERROR] boom', {});
    expect(r.segments.length).toBeGreaterThanOrEqual(1);
    const seg = r.segments[0];
    expect(seg.color).toBe('#ef4444'); // ERROR 默认红色
    expect(seg.isSearch).toBe(false);
  });

  it('整词匹配，不误伤子串', () => {
    const r = renderWithIsolation('LEVEL', 'ERRORS are many', {});
    expect(r.segments).toEqual([]); // ERROR 后跟 S，非整词
  });
});

describe('错误隔离与未注册类型', () => {
  it('未注册类型降级为 no-op', () => {
    const r = renderWithIsolation('NOT_REGISTERED', 'any', { query: 'x' });
    expect(r.segments).toEqual([]);
    expect(r.rowStyle).toBeUndefined();
  });

  it('非法正则降级为 no-op（不抛错）', () => {
    const r = renderWithIsolation('HIGHLIGHT', 'content', {
      query: '([unclosed',
      regex: true,
      color: '#f00',
    });
    expect(r.segments).toEqual([]);
  });

  it('getRenderer 对未注册类型返回 undefined', () => {
    expect(getRenderer('NOPE')).toBeUndefined();
    expect(getRenderer('HIGHLIGHT')).toBeDefined();
  });
});

describe('renderLayers 组合', () => {
  it('聚合多个图层的 segments 与 rowStyle', () => {
    const content = 'ERROR at step 5';
    const r = renderLayers(['HIGHLIGHT', 'ROWTINT'], content, [
      { query: 'ERROR', color: '#ff0000' },
      { query: 'step', color: '#00ff00' },
    ]);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]).toMatchObject({ start: 0, end: 5, color: '#ff0000' });
    expect(r.rowStyle).toEqual({ backgroundColor: '#00ff00' });
  });

  it('单个图层失败不影响其他图层', () => {
    const content = 'ERROR here';
    const r = renderLayers(['HIGHLIGHT', 'BAD_RENDERER', 'ROWTINT'], content, [
      { query: 'ERROR', color: '#ff0000' },
      { query: 'x' },
      { query: 'here', color: '#00ff00' },
    ]);
    expect(r.segments).toHaveLength(1);
    expect(r.rowStyle).toEqual({ backgroundColor: '#00ff00' });
  });

  it('返回类型为 RenderResult（segments + rowStyle）', () => {
    const r: RenderResult = renderLayers([], 'content', []);
    expect(r.segments).toEqual([]);
    expect(r.rowStyle).toBeUndefined();
  });
});

describe('插件静态边界（无动态代码加载）', () => {
  const widgetInput = (rendererId: string, text = 'plugin-text') => ({
    data: { text },
    config: {},
    widget: {
      type: 'W_P',
      plugin_id: 'acme.p',
      display_name: 'P',
      description: '',
      slot: 'statusbar' as const,
      renderer_id: rendererId,
      config: {},
      role: 'statusbar' as const,
      refresh_interval: 0,
    },
  });

  it('远程/路径形态的 renderer_id 不被加载，降级为 undefined', () => {
    expect(
      renderWidgetWithIsolation(
        'http://evil.example/x.js',
        widgetInput('http://evil.example/x.js'),
      ),
    ).toBeUndefined();
    expect(
      renderWidgetWithIsolation('../plugins/evil', widgetInput('../plugins/evil')),
    ).toBeUndefined();
    expect(getWidgetRenderer('http://evil.example/x.js')).toBeUndefined();
  });

  it('新视觉能力必须先在应用 registry 注册，之后 manifest 才能引用', () => {
    expect(renderWidgetWithIsolation('future.trend', widgetInput('future.trend'))).toBeUndefined();
    registerWidgetRenderer('future.trend', ({ data }) => ({ text: `[${data.text}]` }));
    expect(renderWidgetWithIsolation('future.trend', widgetInput('future.trend'))?.text).toBe(
      '[plugin-text]',
    );
  });

  it('未知字段进入 extra，不产生任何执行通道', () => {
    expect(renderWidgetWithIsolation('', widgetInput('', 'x'))).toBeUndefined();
  });
});
