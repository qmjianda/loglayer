import { describe, expect, it } from 'vitest';
import { isKnownSlot, usePluginWidgets } from './usePluginWidgets';

describe('plugin widget slots', () => {
  it('accepts only fixed slots', () => {
    expect(isKnownSlot('sidebar')).toBe(true);
    expect(isKnownSlot('inspector')).toBe(true);
    expect(isKnownSlot('statusbar')).toBe(true);
    expect(isKnownSlot('editor_toolbar')).toBe(true);
    expect(isKnownSlot('floating-window')).toBe(false);
  });

  it('exposes the hook for declaration-only slot consumption', () => {
    expect(typeof usePluginWidgets).toBe('function');
  });
});
