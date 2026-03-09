import { describe, it, expect, vi } from 'vitest';
import { MAX_PANES } from '../hooks/usePaneManagement';

describe('hooks/usePaneManagement', () => {
  describe('MAX_PANES', () => {
    it('should be 4', () => {
      expect(MAX_PANES).toBe(4);
    });

    it('should be a positive number', () => {
      expect(MAX_PANES).toBeGreaterThan(0);
    });
  });
});
