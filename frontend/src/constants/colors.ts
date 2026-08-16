/**
 * 推荐色板与最近使用色工具（layer-interaction-redesign 阶段 2）
 *
 * 三处入口共用（右键子菜单 / 拖选浮动条 / ColorPicker）：
 * - RECOMMENDED_COLORS：两行 16 色（8 色相 × 2 明暗梯度），含日志语义色
 * - 最近使用色：localStorage 持久化（loglayer.recentColors），跨会话保留
 */

export const RECOMMENDED_COLORS: string[] = [
  // 第一行：8 色相（日志语义主色，深色梯度）
  '#ef4444', // 红 ERROR
  '#f59e0b', // 橙
  '#eab308', // 黄 WARN
  '#22c55e', // 绿 INFO
  '#3b82f6', // 蓝 DEBUG
  '#8b5cf6', // 紫
  '#ec4899', // 粉
  '#06b6d4', // 青
  // 第二行：8 色相（浅色梯度）
  '#f87171',
  '#fbbf24',
  '#fde047',
  '#4ade80',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#22d3ee',
];

export const RECENT_COLORS_LIMIT = 8;

const STORAGE_KEY = 'loglayer.recentColors';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function normalizeColor(color: string): string | null {
  return HEX_RE.test(color) ? color.toLowerCase() : null;
}

export function getRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => normalizeColor(c) !== null);
  } catch {
    return [];
  }
}

export function addRecentColor(color: string): void {
  const normalized = normalizeColor(color);
  if (!normalized) return;
  const rest = getRecentColors().filter((c) => c !== normalized);
  const next = [normalized, ...rest].slice(0, RECENT_COLORS_LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage 不可用（隐私模式等）时静默忽略
  }
}

export function clearRecentColors(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
}
