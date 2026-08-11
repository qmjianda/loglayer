import { useState, useEffect } from 'react';

/**
 * 统一搜索防抖（perf-deepening / search-debounce D5）
 *
 * 返回 value 的防抖副本：初始立即返回当前值；
 * 之后每次 value 变化重置定时器，仅在停止变化 delayMs 后才更新为最新值。
 * 所有搜索入口（侧边栏 SearchPanel / Ctrl+F find widget）统一经此单层防抖触发后端搜索。
 */
export const SEARCH_DEBOUNCE_MS = 250;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
