/**
 * Text measuring utilities for LogViewer
 * Provides CJK-safe text width measurement using Canvas API
 */

export interface TextMeasurer {
  /**
   * Get pixel width for a substring
   * @param text - Full text string
   * @param start - Start index (inclusive)
   * @param end - End index (exclusive)
   * @returns Width in pixels
   */
  measureSubstringWidth(text: string, start: number, end: number): number;

  /**
   * Convert pixel x-offset within a line's text to a character index using binary search
   * @param text - Full text string
   * @param xOffset - Pixel offset from left
   * @returns Character index
   */
  charIndexFromX(text: string, xOffset: number): number;
}

/**
 * Create a text measurer with the specified font
 * Uses Canvas API for accurate CJK character measurement
 * @param font - CSS font string (e.g., "14px monospace")
 * @returns TextMeasurer interface
 */
export function createTextMeasurer(font: string): TextMeasurer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  ctx.font = font;

  /**
   * Get pixel width for text.substring(start, end) using actual measureText
   * CJK characters are measured accurately via Canvas API
   */
  function measureSubstringWidth(text: string, start: number, end: number): number {
    if (start >= end) return 0;
    return ctx.measureText(text.substring(start, end)).width;
  }

  /**
   * Convert pixel x-offset within a line's text to a character index (binary search)
   * Uses binary search to find the character position, then snaps to nearest boundary
   */
  function charIndexFromX(text: string, xOffset: number): number {
    if (xOffset <= 0 || !text) return 0;

    let low = 0;
    let high = text.length;

    while (low < high) {
      const mid = (low + high) >> 1;
      if (ctx.measureText(text.substring(0, mid)).width < xOffset) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    if (low > 0) {
      const prevW = ctx.measureText(text.substring(0, low - 1)).width;
      const curW = ctx.measureText(text.substring(0, low)).width;
      if (xOffset - prevW < curW - xOffset) return low - 1;
    }

    return Math.min(low, text.length);
  }

  return {
    measureSubstringWidth,
    charIndexFromX,
  };
}