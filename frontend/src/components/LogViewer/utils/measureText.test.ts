import { describe, expect, it } from 'vitest';
import { createTextMeasurer } from './measureText';

describe('createTextMeasurer', () => {
  it('creates a text measurer with given font', () => {
    const measurer = createTextMeasurer('14px monospace');
    expect(measurer).toBeDefined();
    expect(typeof measurer.measureSubstringWidth).toBe('function');
    expect(typeof measurer.charIndexFromX).toBe('function');
  });

  describe('measureSubstringWidth', () => {
    it('returns 0 for empty range (start >= end)', () => {
      const measurer = createTextMeasurer('14px monospace');
      expect(measurer.measureSubstringWidth('hello', 5, 5)).toBe(0);
      expect(measurer.measureSubstringWidth('hello', 3, 2)).toBe(0);
    });

    it('returns positive width for ASCII text', () => {
      const measurer = createTextMeasurer('14px monospace');
      const width = measurer.measureSubstringWidth('hello', 0, 5);
      expect(width).toBeGreaterThan(0);
    });

    it('returns correct width for substring', () => {
      const measurer = createTextMeasurer('14px monospace');
      const fullWidth = measurer.measureSubstringWidth('hello', 0, 5);
      const halfWidth = measurer.measureSubstringWidth('hello', 0, 2);
      expect(halfWidth).toBeLessThan(fullWidth);
    });
  });

  describe('charIndexFromX', () => {
    it('returns 0 for xOffset <= 0', () => {
      const measurer = createTextMeasurer('14px monospace');
      expect(measurer.charIndexFromX('hello', 0)).toBe(0);
      expect(measurer.charIndexFromX('hello', -1)).toBe(0);
    });

    it('returns 0 for empty text', () => {
      const measurer = createTextMeasurer('14px monospace');
      expect(measurer.charIndexFromX('', 10)).toBe(0);
    });

    it('returns valid index for positive xOffset', () => {
      const measurer = createTextMeasurer('14px monospace');
      const width = measurer.measureSubstringWidth('hello', 0, 5);
      const index = measurer.charIndexFromX('hello', width / 2);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(5);
    });

    it('respects text length boundary', () => {
      const measurer = createTextMeasurer('14px monospace');
      const width = measurer.measureSubstringWidth('hello', 0, 5);
      const index = measurer.charIndexFromX('hello', width + 100);
      expect(index).toBeLessThanOrEqual(5);
    });
  });
});