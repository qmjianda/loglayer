/**
 * Selection Utilities
 * 
 * Helper functions for text selection handling in LogViewer.
 * Pure functions with no external dependencies.
 */

/**
 * Input selection type from mouse/touch events
 */
export interface SelectionInput {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

/**
 * Normalized selection with guaranteed top-to-bottom order
 */
export interface NormalizedSelection {
  topLine: number;
  topChar: number;
  bottomLine: number;
  bottomChar: number;
}

/**
 * Character range for a single line [start, end)
 */
export interface LineCharRange {
  s: number;
  e: number;
}

/**
 * Normalize selection to top-to-bottom order regardless of drag direction.
 * Returns { topLine, topChar, bottomLine, bottomChar }.
 * 
 * @param sel - The selection to normalize
 * @returns Normalized selection with guaranteed top <= bottom
 */
export function normalizeSelection(sel: SelectionInput): NormalizedSelection {
  if (sel.startLine < sel.endLine || (sel.startLine === sel.endLine && sel.startChar <= sel.endChar)) {
    return { topLine: sel.startLine, topChar: sel.startChar, bottomLine: sel.endLine, bottomChar: sel.endChar };
  }
  return { topLine: sel.endLine, topChar: sel.endChar, bottomLine: sel.startLine, bottomChar: sel.startChar };
}

/**
 * Get the character range [s, e) for a given line index within a normalized selection.
 * 
 * @param lineIndex - The line index to get range for
 * @param norm - Normalized selection (from normalizeSelection)
 * @param contentLength - Maximum character length of the line
 * @returns Character range { s, e } where s is start (inclusive), e is end (exclusive)
 */
export function getLineSelectionRange(
  lineIndex: number,
  norm: NormalizedSelection,
  contentLength: number
): LineCharRange {
  let s = 0, e = contentLength;
  if (norm.topLine === norm.bottomLine) {
    s = norm.topChar;
    e = norm.bottomChar;
  } else if (lineIndex === norm.topLine) {
    s = norm.topChar;
    // e stays contentLength (select to end of line)
  } else if (lineIndex === norm.bottomLine) {
    e = norm.bottomChar;
    // s stays 0 (select from start of line)
  }
  // else: middle line, s=0, e=contentLength (entire line)
  return { s, e };
}