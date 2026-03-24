import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  normalizeSelection,
  getLineSelectionRange,
  renderLine,
  LogViewerColors,
  Selection,
  RenderLineParams,
} from '@/components/LogViewer/canvas/LineRenderer';

describe('normalizeSelection', () => {
  it('returns selection as-is when already normalized (start before end)', () => {
    const sel: Selection = {
      startLine: 5,
      startChar: 10,
      endLine: 10,
      endChar: 20,
    };
    const result = normalizeSelection(sel);
    expect(result.topLine).toBe(5);
    expect(result.topChar).toBe(10);
    expect(result.bottomLine).toBe(10);
    expect(result.bottomChar).toBe(20);
  });

  it('reverses selection when start is after end', () => {
    const sel: Selection = {
      startLine: 10,
      startChar: 20,
      endLine: 5,
      endChar: 10,
    };
    const result = normalizeSelection(sel);
    expect(result.topLine).toBe(5);
    expect(result.topChar).toBe(10);
    expect(result.bottomLine).toBe(10);
    expect(result.bottomChar).toBe(20);
  });

  it('handles single line selection where start > end', () => {
    const sel: Selection = {
      startLine: 5,
      startChar: 20,
      endLine: 5,
      endChar: 10,
    };
    const result = normalizeSelection(sel);
    expect(result.topLine).toBe(5);
    expect(result.topChar).toBe(10);
    expect(result.bottomLine).toBe(5);
    expect(result.bottomChar).toBe(20);
  });
});

describe('getLineSelectionRange', () => {
  const makeNorm = (topLine: number, topChar: number, bottomLine: number, bottomChar: number) => ({
    topLine,
    topChar,
    bottomLine,
    bottomChar,
  });

  it('returns range for selection within single line', () => {
    const norm = makeNorm(5, 10, 5, 20);
    const result = getLineSelectionRange(5, norm, 100);
    expect(result.s).toBe(10);
    expect(result.e).toBe(20);
  });

  it('returns full line range for middle lines in multi-line selection', () => {
    const norm = makeNorm(5, 10, 10, 20);
    const result = getLineSelectionRange(7, norm, 100);
    expect(result.s).toBe(0);
    expect(result.e).toBe(100);
  });

  it('returns start to end for first line of multi-line', () => {
    const norm = makeNorm(5, 10, 10, 20);
    const result = getLineSelectionRange(5, norm, 100);
    expect(result.s).toBe(10);
    expect(result.e).toBe(100);
  });

  it('returns 0 to endChar for last line of multi-line', () => {
    const norm = makeNorm(5, 10, 10, 20);
    const result = getLineSelectionRange(10, norm, 100);
    expect(result.s).toBe(0);
    expect(result.e).toBe(20);
  });
});

describe('renderLine', () => {
  let mockCtx: {
    fillStyle: string;
    fillRect: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    strokeStyle: string;
    strokeRect: ReturnType<typeof vi.fn>;
    lineWidth: number;
    beginPath: ReturnType<typeof vi.fn>;
    moveTo: ReturnType<typeof vi.fn>;
    lineTo: ReturnType<typeof vi.fn>;
    closePath: ReturnType<typeof vi.fn>;
    arc: ReturnType<typeof vi.fn>;
    createLinearGradient: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    rect: ReturnType<typeof vi.fn>;
    clip: ReturnType<typeof vi.fn>;
    font: string;
    textAlign: string;
    textBaseline: string;
    measureText: ReturnType<typeof vi.fn>;
    roundRect: ReturnType<typeof vi.fn>;
  };
  let defaultColors: LogViewerColors;

  beforeEach(() => {
    mockCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
      fill: vi.fn(),
      strokeStyle: '',
      strokeRect: vi.fn(),
      lineWidth: 1,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      save: vi.fn(),
      restore: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      roundRect: vi.fn(),
    };

    defaultColors = {
      BACKGROUND: '#000000',
      TEXT: '#ffffff',
      GUTTER: '#1a1a1a',
      GUTTER_TEXT: '#888888',
      GUTTER_SEPARATOR: '#333333',
      SELECTION: 'rgba(245, 158, 11, 0.45)',
      HIGHLIGHT_LINE: 'rgba(34, 211, 238, 0.15)',
      CURRENT_LINE: '#22d3ee',
      HOVER_LINE: 'rgba(255, 255, 255, 0.05)',
      BOOKMARK_BACKGROUND: 'rgba(234, 179, 8, 0.15)',
      BOOKMARK_INDICATOR: '#eab308',
      JUMP_PULSE: 'rgba(59, 130, 246, 0.25)',
      JUMP_PULSE_BORDER: 'rgba(59, 130, 246, 0.6)',
      WORD_HIGHLIGHT: 'rgba(6, 182, 212, 0.35)',
      SEARCH_HIGHLIGHT: '#facc15',
      SEARCH_HIGHLIGHT_ACTIVE: '#ff9632',
      LAYER_HIGHLIGHT: '#3b82f6',
    };
  });

  const makeParams = (overrides: Partial<RenderLineParams> = {}): RenderLineParams => ({
    ctx: mockCtx as unknown as CanvasRenderingContext2D,
    lineIndex: 0,
    content: 'test line content',
    logLine: null,
    y: 0,
    lineHeight: 20,
    viewportWidth: 800,
    effectiveViewportWidth: 800,
    effectiveRulerWidth: 0,
    gutterWidth: 60,
    showLineNumbers: true,
    safeScrollLeft: 0,
    charWidthRef: { current: 8 },
    font: '14px monospace',
    fontSize: 14,
    colors: defaultColors,
    showWhitespace: false,
    wordWrap: false,
    highlightedIndex: -1,
    hoveredLineIndex: -1,
    jumpPulseIndex: -1,
    isSelecting: false,
    selection: null,
    highlightedWord: null,
    searchHighlightAll: false,
    ...overrides,
  });

  it('renders without errors with minimal params', () => {
    const params = makeParams();
    expect(() => renderLine(params)).not.toThrow();
  });

  it('renders jump pulse effect when jumpPulseIndex matches', () => {
    const params = makeParams({ jumpPulseIndex: 0 });
    renderLine(params);
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.strokeRect).toHaveBeenCalled();
  });

  it('renders current line highlight when highlightedIndex matches', () => {
    const params = makeParams({ highlightedIndex: 0 });
    renderLine(params);
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it('renders hover highlight when hoveredLineIndex matches', () => {
    const params = makeParams({ hoveredLineIndex: 0, isSelecting: false });
    renderLine(params);
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it('renders bookmark when logLine has isMarked', () => {
    const params = makeParams({
      logLine: {
        index: 0,
        content: 'test',
        isMarked: true,
      },
    });
    renderLine(params);
    expect(mockCtx.beginPath).toHaveBeenCalled();
  });

  it('renders text content', () => {
    const params = makeParams({
      logLine: {
        index: 0,
        content: 'hello world',
      },
    });
    renderLine(params);
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('renders gutter with line numbers when showLineNumbers is true', () => {
    const params = makeParams({ showLineNumbers: true });
    renderLine(params);
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });
});