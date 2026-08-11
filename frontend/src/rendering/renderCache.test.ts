/**
 * 渲染结果跨行 LRU 缓存验收测试（perf-deepening / render-throttling）
 *
 * 追溯 spec: render-throttling → "渲染结果跨行缓存"
 * - 重复内容行共享结果（命中缓存不重算）
 * - 缓存有界淘汰（超过上限淘汰最久未用）
 * - 配置签名区分（同内容不同配置不串用）
 */
import { describe, it, expect } from 'vitest';
import { createRenderCache, buildRenderKey } from './registry';
import type { RenderResult } from './types';

describe('createRenderCache 有界 LRU（渲染结果跨行缓存）', () => {
  it('相同 key 命中返回同一引用（不重算）', () => {
    const cache = createRenderCache(10);
    const entry: RenderResult = {
      segments: [{ start: 0, end: 5, color: '#f00', opacity: 80, isSearch: false }],
    };
    cache.set('k1', entry);
    expect(cache.get('k1')).toBe(entry);
  });

  it('超过上限淘汰最久未用条目（容量保持在限制内）', () => {
    const cache = createRenderCache(2);
    cache.set('a', { segments: [] });
    cache.set('b', { segments: [] });
    cache.set('c', { segments: [] });
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
    expect(cache.size).toBe(2);
  });

  it('命中刷新最近使用（LRU 语义：被访问的 key 不被淘汰）', () => {
    const cache = createRenderCache(2);
    cache.set('a', { segments: [] });
    cache.set('b', { segments: [] });
    cache.get('a'); // 刷新 a 的最近使用
    cache.set('c', { segments: [] });
    expect(cache.get('b')).toBeUndefined(); // b 最久未用被淘汰
    expect(cache.get('a')).toBeDefined();
  });
});

describe('buildRenderKey 配置签名（渲染结果跨行缓存）', () => {
  it('同内容不同配置产生不同 key（不串用旧配置结果）', () => {
    const k1 = buildRenderKey('ERROR happened', [
      { type: 'HIGHLIGHT', config: { query: 'ERROR', color: '#f00' } },
    ]);
    const k2 = buildRenderKey('ERROR happened', [
      { type: 'HIGHLIGHT', config: { query: 'error', color: '#f00' } },
    ]);
    expect(k1).not.toBe(k2);
  });

  it('同内容同配置产生一致 key（可命中共享）', () => {
    const configs = [{ type: 'HIGHLIGHT', config: { query: 'ERROR', color: '#f00' } }];
    expect(buildRenderKey('ERROR happened', configs)).toBe(
      buildRenderKey('ERROR happened', configs),
    );
  });

  it('不同内容同配置产生不同 key', () => {
    const configs = [{ type: 'HIGHLIGHT', config: { query: 'ERROR' } }];
    expect(buildRenderKey('ERROR a', configs)).not.toBe(buildRenderKey('ERROR b', configs));
  });
});
