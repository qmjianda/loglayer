import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { CanvasRenderer } from '@/components/LogViewer/canvas/CanvasRenderer';

describe('canvas/CanvasRenderer', () => {
  it('should render canvas when isVisible is true', () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    
    render(
      <CanvasRenderer
        canvasRef={canvasRef}
        viewportWidth={800}
        viewportHeight={600}
        totalLines={1000}
        startIndex={0}
        endIndex={50}
        isVisible={true}
      />
    );

    const canvas = screen.getByRole('log');
    expect(canvas).toBeInTheDocument();
  });

  it('should not render when isVisible is false', () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    
    const { container } = render(
      <CanvasRenderer
        canvasRef={canvasRef}
        viewportWidth={800}
        viewportHeight={600}
        totalLines={1000}
        startIndex={0}
        endIndex={50}
        isVisible={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should have correct accessibility attributes', () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    
    render(
      <CanvasRenderer
        canvasRef={canvasRef}
        viewportWidth={800}
        viewportHeight={600}
        totalLines={5000}
        startIndex={99}
        endIndex={150}
        isVisible={true}
      />
    );

    const canvas = screen.getByRole('log');
    expect(canvas).toHaveAttribute('role', 'log');
    expect(canvas).toHaveAttribute('aria-readonly', 'true');
    expect(canvas).toHaveAttribute('aria-label', '日志视图，共 5,000 行。当前显示第 100 到 150 行');
  });

  it('should have tabIndex for keyboard navigation', () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    
    render(
      <CanvasRenderer
        canvasRef={canvasRef}
        viewportWidth={800}
        viewportHeight={600}
        totalLines={100}
        startIndex={0}
        endIndex={50}
        isVisible={true}
      />
    );

    const canvas = screen.getByRole('log');
    expect(canvas).toHaveAttribute('tabIndex', '0');
  });

  it('should apply correct styles', () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    
    render(
      <CanvasRenderer
        canvasRef={canvasRef}
        viewportWidth={800}
        viewportHeight={600}
        totalLines={100}
        startIndex={0}
        endIndex={50}
        isVisible={true}
      />
    );

    const canvas = screen.getByRole('log');
    const styles = window.getComputedStyle(canvas);
    
    expect(styles.position).toBe('absolute');
    expect(styles.pointerEvents).toBe('none');
    expect(styles.top).toBe('0px');
    expect(styles.left).toBe('0px');
  });

  it('should forward ref to canvas element', () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    
    render(
      <CanvasRenderer
        canvasRef={canvasRef}
        viewportWidth={800}
        viewportHeight={600}
        totalLines={100}
        startIndex={0}
        endIndex={50}
        isVisible={true}
      />
    );

    expect(canvasRef.current).toBeTruthy();
    expect(canvasRef.current?.tagName).toBe('CANVAS');
  });

  it('should format large numbers in aria-label', () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    
    render(
      <CanvasRenderer
        canvasRef={canvasRef}
        viewportWidth={800}
        viewportHeight={600}
        totalLines={1000000}
        startIndex={0}
        endIndex={100}
        isVisible={true}
      />
    );

    const canvas = screen.getByRole('log');
    expect(canvas).toHaveAttribute('aria-label', expect.stringContaining('1,000,000'));
  });

  it('should handle zero totalLines', () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    
    render(
      <CanvasRenderer
        canvasRef={canvasRef}
        viewportWidth={800}
        viewportHeight={600}
        totalLines={0}
        startIndex={0}
        endIndex={0}
        isVisible={true}
      />
    );

    const canvas = screen.getByRole('log');
    expect(canvas).toHaveAttribute('aria-label', '日志视图，共 0 行。当前显示第 1 到 0 行');
  });
});