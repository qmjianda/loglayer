import { describe, it, expect } from 'vitest';
import { LOG_VIEWER, KEYBOARD_SHORTCUTS } from './constants';

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

  describe('KEYBOARD_SHORTCUTS', () => {
    it('should have go to line shortcut', () => {
      expect(KEYBOARD_SHORTCUTS.GO_TO_LINE).toEqual({
        key: 'g',
        modifier: 'ctrl',
      });
    });

    it('should have move selection shortcuts', () => {
      expect(KEYBOARD_SHORTCUTS.MOVE_SELECTION_UP).toEqual({
        key: 'ArrowUp',
        modifier: 'alt',
      });
      expect(KEYBOARD_SHORTCUTS.MOVE_SELECTION_DOWN).toEqual({
        key: 'ArrowDown',
        modifier: 'alt',
      });
    });

    it('should have select all shortcut', () => {
      expect(KEYBOARD_SHORTCUTS.SELECT_ALL).toEqual({
        key: 'a',
        modifier: 'ctrl',
      });
    });

    it('should have all required shortcuts', () => {
      const required = ['GO_TO_LINE', 'SELECT_LINE', 'JUMP_TO_SELECTION', 
                       'MOVE_SELECTION_UP', 'MOVE_SELECTION_DOWN', 'SELECT_ALL'];
      required.forEach(key => {
        expect(KEYBOARD_SHORTCUTS).toHaveProperty(key);
      });
    });
  });
});
