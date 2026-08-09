/**
 * utils/index.ts - 前端公共工具函数库
 *
 * 提取重复的逻辑，提高代码复用性和可测试性。
 */

/**
 * 从完整路径中提取文件/文件夹名称
 * @param path 完整路径（支持 Windows 和 Unix 风格）
 * @returns 基础名称
 */
export function basename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/**
 * 从 Set 中移除一个元素，返回新 Set（不可变操作）
 * @param set 原始 Set
 * @param item 要移除的元素
 * @returns 新的 Set
 */
export function removeFromSet<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set);
  next.delete(item);
  return next;
}

/**
 * 向 Set 中添加一个元素，返回新 Set（不可变操作）
 * @param set 原始 Set
 * @param item 要添加的元素
 * @returns 新的 Set
 */
export function addToSet<T>(set: Set<T>, item: T): Set<T> {
  return new Set(set).add(item);
}

/**
 * 格式化文件大小为人类可读的字符串
 * @param bytes 字节数
 * @returns 格式化后的字符串，如 "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 生成唯一 ID
 * @param prefix 可选前缀
 * @returns 唯一 ID 字符串
 */
export function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 基于文件路径（uri）的稳定面板 id：`log-view-<hash>`。
 *
 * 与每次会话变化的 fileId 解耦，同一文件跨会话/跨刷新 id 稳定，
 * 保证 dockview 布局保存/恢复后仍命中同一面板。uri 变更（文件移动）
 * 会导致 id 变化，属正常布局重置。
 * @param uri 文件绝对路径
 * @returns 稳定面板 id
 */
export function panelIdForFile(uri?: string | null): string {
  const path = uri || '';
  // djb2 hash：跨会话稳定，仅依赖字符串内容
  let hash = 5381;
  for (let i = 0; i < path.length; i++) {
    hash = ((hash << 5) + hash + path.charCodeAt(i)) >>> 0;
  }
  return `log-view-${hash.toString(36)}`;
}

/**
 * 防抖函数
 * @param fn 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * 获取后端服务 URL
 * @returns 后端 URL 字符串
 */
export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const isDev = window.location.port === '3000';
    if (isDev) {
      return 'http://127.0.0.1:12345';
    }
    return window.location.protocol + '//' + window.location.host;
  }
  return '';
}

/**
 * 通用 fetch JSON 函数
 * @param endpoint API 端点
 * @param method HTTP 方法
 * @param body 请求体（可选）
 * @returns 解析后的 JSON 数据
 */
export async function fetchJson<T>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
): Promise<T> {
  const BACKEND_URL = getBackendUrl();
  const res = await fetch(`${BACKEND_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }
  return res.json();
}
