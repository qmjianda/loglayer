import { describe, it, expect } from 'vitest';
import { LOG_VIEWER } from './constants';
import { SHORTCUT_REGISTRY } from './shortcuts/registry';

describe('constants', () => {
  describe('LOG_VIEWER', () => {
    it('should have valid line height', () => {
      expect(LOG_VIEWER.LINE_HEIGHT).toBeGreaterThan(0);
    });

    it('should have valid buffer sizes', () => {
      expect(LOG_VIEWER.BUFFER_NORMAL).toBeGreaterThan(0);
      expect(LOG_VIEWER.BUFFER_LARGE).toBeGreaterThan(LOG_VIEWER.BUFFER_NORMAL);
    });

    it('should have valid cache settings', () => {
      expect(LOG_VIEWER.MAX_CACHED_LINES).toBeGreaterThan(0);
      expect(LOG_VIEWER.CACHE_CLEAR_DISTANCE).toBeGreaterThan(0);
    });

    it('should have valid performance settings', () => {
      expect(LOG_VIEWER.TARGET_FPS).toBeGreaterThan(0);
      expect(LOG_VIEWER.IDLE_THRESHOLD_MS).toBeGreaterThan(0);
      expect(LOG_VIEWER.RENDER_BATCH_SIZE).toBeGreaterThan(0);
    });

    it('should have valid memory threshold', () => {
      expect(LOG_VIEWER.MEMORY_WARNING_THRESHOLD_MB).toBeGreaterThan(0);
    });

    it('should have monospace font configured', () => {
      expect(LOG_VIEWER.FONT).toContain('monospace');
      expect(LOG_VIEWER.FONT_GUTTER).toContain('monospace');
    });

    it('should have correct cache prune setting', () => {
      expect(typeof LOG_VIEWER.CACHE_PRUNE_ON_IDLE).toBe('boolean');
    });
  });
});

describe('SHORTCUT_REGISTRY', () => {
  it('should have gotoLine shortcut', () => {
    expect(SHORTCUT_REGISTRY.gotoLine).toBeDefined();
    expect(SHORTCUT_REGISTRY.gotoLine.keys).toContain('Ctrl+G');
  });

  it('should have move selection shortcuts', () => {
    expect(SHORTCUT_REGISTRY.moveSelectionUp).toBeDefined();
    expect(SHORTCUT_REGISTRY.moveSelectionDown).toBeDefined();
  });

  it('should have selectAll shortcut', () => {
    expect(SHORTCUT_REGISTRY.selectAll).toBeDefined();
    expect(SHORTCUT_REGISTRY.selectAll.keys).toContain('Ctrl+A');
  });

  it('should have all essential shortcuts', () => {
    const required = ['gotoLine', 'selectLine', 'jumpToSelection', 
                     'moveSelectionUp', 'moveSelectionDown', 'selectAll',
                     'find', 'findNext', 'findPrev', 'openFile', 'openFolder'];
    required.forEach(key => {
      expect(SHORTCUT_REGISTRY).toHaveProperty(key);
    });
  });

  it('should have valid structure for all shortcuts', () => {
    for (const [id, shortcut] of Object.entries(SHORTCUT_REGISTRY)) {
      expect(shortcut).toHaveProperty('id');
      expect(shortcut).toHaveProperty('keys');
      expect(shortcut).toHaveProperty('description');
      expect(shortcut).toHaveProperty('category');
      expect(Array.isArray(shortcut.keys)).toBe(true);
      expect(shortcut.keys.length).toBeGreaterThan(0);
    }
  });
});