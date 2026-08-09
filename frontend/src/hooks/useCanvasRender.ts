/**
 * useCanvasRender - Canvas rendering hook for LogViewer
 *
 * Manages Canvas rendering lifecycle, including resize handling,
 * DPI scaling, and render triggering.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { LOG_VIEWER } from '../constants';

export interface RenderConfig {
  lineHeight: number;
  gutterWidth: number;
  charWidth: number;
  font: string;
  colors: {
    background: string;
    text: string;
    gutter: string;
    gutterText: string;
    highlightLine: string;
    selection: string;
    searchHighlight: string;
    layerHighlight: string;
    currentLine: string;
    bookmarkBackground: string;
    bookmarkIndicator: string;
    ruler: string;
  };
}

export interface UseCanvasRenderOptions {
  config: RenderConfig;
  onCanvasReady?: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void;
}

export interface UseCanvasRenderReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  ctx: CanvasRenderingContext2D | null;
  width: number;
  height: number;
  dpr: number;
  setSize: (width: number, height: number) => void;
  clear: () => void;
  triggerRender: () => void;
  isReady: boolean;
}

export function useCanvasRender(options: UseCanvasRenderOptions): UseCanvasRenderReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [dpr, setDpr] = useState(1);
  const renderTriggerRef = useRef(0);

  const { config, onCanvasReady } = options;

  // Initialize canvas and context
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    ctxRef.current = context;

    // Apply font
    context.font = config.font;

    // Calculate DPR
    const devicePixelRatio = window.devicePixelRatio || 1;
    setDpr(devicePixelRatio);

    onCanvasReady?.(canvas, context);
  }, [config.font, onCanvasReady]);

  // Handle resize
  const handleResize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    if (width > 0 && height > 0) {
      setSize({ width, height });
    }
  }, []);

  // Apply size to canvas with DPR support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;

    const devicePixelRatio = window.devicePixelRatio || 1;

    canvas.width = size.width * devicePixelRatio;
    canvas.height = size.height * devicePixelRatio;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const ctx = ctxRef.current;
    if (ctx) {
      ctx.scale(devicePixelRatio, devicePixelRatio);
      ctx.font = config.font;
    }
  }, [size, config.font]);

  // Setup resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Initial size
    handleResize();

    return () => resizeObserver.disconnect();
  }, [handleResize]);

  // Initialize on mount
  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // Set size manually
  const setCanvasSize = useCallback((width: number, height: number) => {
    setSize({ width, height });
  }, []);

  // Clear canvas
  const clear = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.fillStyle = config.colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [config.colors.background]);

  // Trigger re-render
  const triggerRender = useCallback(() => {
    renderTriggerRef.current += 1;
  }, []);

  const isReady = ctxRef.current !== null && size.width > 0 && size.height > 0;

  return {
    canvasRef,
    containerRef,
    ctx: ctxRef.current,
    width: size.width,
    height: size.height,
    dpr,
    setSize: setCanvasSize,
    clear,
    triggerRender,
    isReady,
  };
}
