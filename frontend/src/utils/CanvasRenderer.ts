/**
 * CanvasRenderer - Pure rendering functions for LogViewer
 * 
 * Contains no React dependencies - just canvas drawing logic.
 */

import { LogLine } from '../types';
import { LOG_VIEWER } from '../constants';

export interface RenderConfig {
    lineHeight: number;
    gutterWidth: number;
    charWidth: number;
    font: string;
    fontGutter: string;
    colors: LogViewerColors;
}

export interface LogViewerColors {
    BACKGROUND: string;
    GUTTER: string;
    GUTTER_TEXT: string;
    HIGHLIGHT_LINE: string;
    BOOKMARK_BACKGROUND: string;
    BOOKMARK_INDICATOR: string;
    SELECTION: string;
    TEXT: string;
    RULER: string;
    SEARCH_HIGHLIGHT: string;
    LAYER_HIGHLIGHT: string;
    CURRENT_LINE: string;
}

export interface RenderLineOptions {
    lineIndex: number;
    content: string;
    y: number;
    scrollLeft: number;
    config: RenderConfig;
    isHighlighted?: boolean;
    isBookmarked?: boolean;
    isCurrentLine?: boolean;
    searchHighlights?: { start: number; end: number }[];
    layerColors?: string[];
    selection?: { start: number; end: number } | null;
}

export interface RenderGutterOptions {
    lineNumber: number;
    y: number;
    config: RenderConfig;
    isCurrentLine?: boolean;
}

export interface RenderBackgroundOptions {
    width: number;
    height: number;
    config: RenderConfig;
    visibleLineStart: number;
    visibleLineEnd: number;
    currentLineIndex?: number;
    bookmarkedLines?: Set<number>;
}

class CanvasRenderer {
    /**
     * Clear entire canvas with background color
     */
    clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, config: RenderConfig): void {
        ctx.fillStyle = config.colors.BACKGROUND;
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * Render background for visible range
     */
    renderBackground(ctx: CanvasRenderingContext2D, options: RenderBackgroundOptions): void {
        const { width, height, config, visibleLineStart, visibleLineEnd, currentLineIndex, bookmarkedLines } = options;
        
        this.clearCanvas(ctx, width, height, config);

        // Render current line highlight
        if (currentLineIndex !== undefined && currentLineIndex >= visibleLineStart && currentLineIndex <= visibleLineEnd) {
            const y = (currentLineIndex - visibleLineStart) * config.lineHeight;
            ctx.fillStyle = config.colors.HIGHLIGHT_LINE;
            ctx.fillRect(0, y, width, config.lineHeight);
        }

        // Render bookmarked lines
        if (bookmarkedLines && bookmarkedLines.size > 0) {
            for (let i = visibleLineStart; i <= visibleLineEnd; i++) {
                if (bookmarkedLines.has(i)) {
                    const y = (i - visibleLineStart) * config.lineHeight;
                    ctx.fillStyle = config.colors.BOOKMARK_BACKGROUND;
                    ctx.fillRect(0, y, width, config.lineHeight);
                }
            }
        }
    }

    /**
     * Render gutter (line numbers)
     */
    renderGutter(ctx: CanvasRenderingContext2D, options: RenderGutterOptions): void {
        const { lineNumber, y, config, isCurrentLine } = options;
        
        // Gutter background
        ctx.fillStyle = config.colors.GUTTER;
        ctx.fillRect(0, y, config.gutterWidth, config.lineHeight);

        // Line number
        ctx.font = config.fontGutter;
        ctx.fillStyle = isCurrentLine ? config.colors.CURRENT_LINE : config.colors.GUTTER_TEXT;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        const text = String(lineNumber + 1);
        const x = config.gutterWidth - 8;
        ctx.fillText(text, x, y + config.lineHeight / 2);

        // Reset alignment
        ctx.textAlign = 'left';
    }

    /**
     * Render a single log line
     */
    renderLine(ctx: CanvasRenderingContext2D, options: RenderLineOptions): void {
        const { lineIndex, content, y, scrollLeft, config, isHighlighted, isBookmarked, isCurrentLine, searchHighlights, layerColors, selection } = options;
        
        const textX = config.gutterWidth + 8 - scrollLeft;
        
        // Draw layer color indicators
        if (layerColors && layerColors.length > 0) {
            const indicatorWidth = 3;
            layerColors.forEach((color, i) => {
                ctx.fillStyle = color;
                ctx.fillRect(config.gutterWidth + i * indicatorWidth, y, indicatorWidth, config.lineHeight);
            });
        }

        // Draw selection highlight
        if (selection && selection.start <= selection.end) {
            const { start, end } = selection;
            const startX = textX + start * config.charWidth;
            const endX = textX + end * config.charWidth;
            
            ctx.fillStyle = config.colors.SELECTION;
            ctx.fillRect(startX, y, endX - startX, config.lineHeight);
        }

        // Draw search highlights
        if (searchHighlights && searchHighlights.length > 0) {
            searchHighlights.forEach(({ start, end }) => {
                const startX = textX + start * config.charWidth;
                const endX = textX + end * config.charWidth;
                
                ctx.fillStyle = config.colors.SEARCH_HIGHLIGHT;
                ctx.fillRect(startX, y, endX - startX, config.lineHeight);
            });
        }

        // Draw layer highlight overlay
        if (isHighlighted) {
            ctx.fillStyle = config.colors.LAYER_HIGHLIGHT;
            ctx.fillRect(config.gutterWidth, y, ctx.canvas.width - config.gutterWidth, config.lineHeight);
        }

        // Draw bookmark indicator
        if (isBookmarked) {
            ctx.fillStyle = config.colors.BOOKMARK_INDICATOR;
            ctx.fillRect(config.gutterWidth - 3, y, 3, config.lineHeight);
        }

        // Draw text
        ctx.font = config.font;
        ctx.fillStyle = config.colors.TEXT;
        ctx.textBaseline = 'middle';
        
        // Handle text that exceeds viewport
        const maxWidth = ctx.canvas.width - config.gutterWidth - 16;
        let displayText = content;
        
        if (content.length * config.charWidth > maxWidth) {
            const maxChars = Math.floor(maxWidth / config.charWidth);
            displayText = content.substring(0, maxChars);
        }
        
        ctx.fillText(displayText, textX, y + config.lineHeight / 2);
    }

    /**
     * Render ruler/separator
     */
    renderRuler(ctx: CanvasRenderingContext2D, height: number, config: RenderConfig): void {
        ctx.fillStyle = config.colors.RULER;
        ctx.fillRect(config.gutterWidth - 1, 0, 1, height);
    }

    /**
     * Measure text width
     */
    measureText(ctx: CanvasRenderingContext2D, text: string, charWidth: number): number {
        return text.length * charWidth;
    }

    /**
     * Get visible line range with buffer
     */
    getVisibleRange(
        scrollTop: number,
        viewportHeight: number,
        lineHeight: number,
        totalLines: number,
        bufferTop: number = LOG_VIEWER.BUFFER_NORMAL,
        bufferBottom: number = LOG_VIEWER.BUFFER_NORMAL
    ): { start: number; end: number; offsetY: number } {
        const visibleLines = Math.ceil(viewportHeight / lineHeight);
        const start = Math.max(0, Math.floor(scrollTop / lineHeight) - Math.floor(bufferTop / lineHeight));
        const end = Math.min(totalLines - 1, start + visibleLines + Math.floor(bufferBottom / lineHeight));
        const offsetY = start * lineHeight - scrollTop;

        return { start, end, offsetY };
    }
}

export const canvasRenderer = new CanvasRenderer();
