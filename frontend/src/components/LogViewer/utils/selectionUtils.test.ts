import { describe, expect, it } from 'vitest';
import { normalizeSelection, getLineSelectionRange, type SelectionInput, type NormalizedSelection } from './selectionUtils';

describe('normalizeSelection', () => {
  it('returns same order when start is before end', () => {
    const sel: SelectionInput = { startLine: 5, startChar: 10, endLine: 10, endChar: 20 };
    const result = normalizeSelection(sel);
    expect(result).toEqual({ topLine: 5, topChar: 10, bottomLine: 10, bottomChar: 20 });
  });

  it('reverses order when start is after end (downward drag)', () => {
    const sel: SelectionInput = { startLine: 10, startChar: 20, endLine: 5, endChar: 10 };
    const result = normalizeSelection(sel);
    expect(result).toEqual({ topLine: 5, topChar: 10, bottomLine: 10, bottomChar: 20 });
  });

  it('handles same line selection in forward direction', () => {
    const sel: SelectionInput = { startLine: 3, startChar: 5, endLine: 3, endChar: 15 };
    const result = normalizeSelection(sel);
    expect(result).toEqual({ topLine: 3, topChar: 5, bottomLine: 3, bottomChar: 15 });
  });

  it('handles same line selection in reverse direction', () => {
    const sel: SelectionInput = { startLine: 3, startChar: 15, endLine: 3, endChar: 5 };
    const result = normalizeSelection(sel);
    expect(result).toEqual({ topLine: 3, topChar: 5, bottomLine: 3, bottomChar: 15 });
  });

  it('handles zero character positions', () => {
    const sel: SelectionInput = { startLine: 0, startChar: 0, endLine: 2, endChar: 0 };
    const result = normalizeSelection(sel);
    expect(result).toEqual({ topLine: 0, topChar: 0, bottomLine: 2, bottomChar: 0 });
  });
});

describe('getLineSelectionRange', () => {
  const contentLength = 100;

  it('returns full line range for middle lines (not top or bottom)', () => {
    const norm: NormalizedSelection = { topLine: 2, topChar: 5, bottomLine: 8, bottomChar: 50 };
    const result = getLineSelectionRange(5, norm, contentLength);
    expect(result).toEqual({ s: 0, e: contentLength });
  });

  it('returns correct range when selection is on a single line', () => {
    const norm: NormalizedSelection = { topLine: 3, topChar: 10, bottomLine: 3, bottomChar: 50 };
    const result = getLineSelectionRange(3, norm, contentLength);
    expect(result).toEqual({ s: 10, e: 50 });
  });

  it('returns from topChar to contentLength for top line when multi-line', () => {
    const norm: NormalizedSelection = { topLine: 2, topChar: 15, bottomLine: 10, bottomChar: 30 };
    const result = getLineSelectionRange(2, norm, contentLength);
    expect(result).toEqual({ s: 15, e: contentLength });
  });

  it('returns from 0 to bottomChar for bottom line when multi-line', () => {
    const norm: NormalizedSelection = { topLine: 2, topChar: 15, bottomLine: 10, bottomChar: 30 };
    const result = getLineSelectionRange(10, norm, contentLength);
    expect(result).toEqual({ s: 0, e: 30 });
  });

  it('handles edge case when bottomChar is 0', () => {
    const norm: NormalizedSelection = { topLine: 0, topChar: 5, bottomLine: 2, bottomChar: 0 };
    const result = getLineSelectionRange(2, norm, contentLength);
    expect(result).toEqual({ s: 0, e: 0 });
  });

  it('handles different contentLength values', () => {
    const norm: NormalizedSelection = { topLine: 1, topChar: 2, bottomLine: 3, bottomChar: 4 };
    expect(getLineSelectionRange(2, norm, 50)).toEqual({ s: 0, e: 50 });
    expect(getLineSelectionRange(2, norm, 200)).toEqual({ s: 0, e: 200 });
    expect(getLineSelectionRange(1, norm, 200)).toEqual({ s: 2, e: 200 });
    expect(getLineSelectionRange(3, norm, 200)).toEqual({ s: 0, e: 4 });
  });
});