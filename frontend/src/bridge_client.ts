import { FileBridgeAPI } from './types';

interface ApiRequest {
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface ConnectionStateListener {
    onStateChange?: (state: ConnectionState) => void;
    onError?: (error: string) => void;
}

/**
 * 全端唯一的桥接实例。
 * 负责 React 前端与 Python 后端的通信。
 * 已从 QWebChannel 迁移到 REST + WebSockets。
 */
let fileBridge: FileBridgeAPI | null = null;
let initPromise: Promise<FileBridgeAPI | null> | null = null;

// Determine backend URL
const isDev = window.location.port === '3000';
const BACKEND_URL = isDev ? 'http://127.0.0.1:12345' : `${window.location.protocol}//${window.location.host}`;
const WS_URL = BACKEND_URL.replace('http', 'ws') + '/ws';

/**
 * Client-side Signal Emulator
 */
class Signal<T extends (...args: unknown[]) => void> {
    private callbacks: T[] = [];
    connect(cb: T): () => void {
        this.callbacks.push(cb);
        return () => {
            this.disconnect(cb);
        };
    }
    disconnect(cb: T) {
        const index = this.callbacks.indexOf(cb);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }
    emit(...args: Parameters<T>) {
        this.callbacks.forEach(cb => cb(...args));
    }
}

/**
 * 实现 FileBridgeAPI 接口
 */
class WebBridge implements FileBridgeAPI {
    // Signals
    fileLoaded = new Signal<(fileId: string, payloadJson: string) => void>();
    pipelineFinished = new Signal<(fileId: string, newTotal: number, matchCount: number) => void>();
    statsFinished = new Signal<(fileId: string, statsJson: string) => void>();
    operationStarted = new Signal<(fileId: string, opName: string) => void>();
    operationProgress = new Signal<(fileId: string, opName: string, p: number) => void>();
    operationError = new Signal<(fileId: string, opName: string, msg: string) => void>();
    operationStatusChanged = new Signal<(fileId: string, status: string, p: number) => void>();
    pendingFilesCount = new Signal<(count: number) => void>();
    workspaceOpened = new Signal<(path: string) => void>();
    frontendReady = new Signal<() => void>();

    private ws: WebSocket | null = null;

    // Connection state
    private connectionState: ConnectionState = 'disconnected';
    private stateListeners: Set<(state: ConnectionState) => void> = new Set();

    // Reconnect properties
    private retryCount = 0;
    private maxRetries = 10;
    private baseDelay = 2000;
    private reconnectTimer: number | null = null;

    constructor() {
        this.initWebSocket();
    }

    destroy() {
        // 清理WebSocket连接
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.onclose = null;  // 防止触发重连
            this.ws.close();
            this.ws = null;
        }
    }

    private initWebSocket() {
        this.setConnectionState('connecting');
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
            this.setConnectionState('connected');
            this.retryCount = 0;  // Reset on success
        };

        this.ws.onerror = (event) => {
            console.error('[Bridge] WS error:', event);
        };

        this.ws.onmessage = (event) => {
            try {
                const { signal, args } = JSON.parse(event.data);
                const target = (this as Record<string, unknown>)[signal];
                if (target && typeof target === 'object' && 'emit' in target && typeof target.emit === 'function') {
                    (target as { emit: (...args: unknown[]) => void }).emit(...args);
                }
            } catch (e) {
                console.error('[Bridge] WS message error:', e);
            }
        };

        this.ws.onclose = () => {
            this.setConnectionState('disconnected');
            this.handleReconnect();
        };
    }

    private handleReconnect() {
        if (this.retryCount >= this.maxRetries) {
            console.error('[Bridge] Max reconnection attempts reached');
            return;
        }

        this.retryCount++;
        const delay = this.baseDelay * Math.pow(2, this.retryCount - 1);

        this.reconnectTimer = window.setTimeout(() => {
            this.setConnectionState('reconnecting');
            this.initWebSocket();
        }, delay);
    }

    // Connection state methods
    getConnectionState(): ConnectionState {
        return this.connectionState;
    }

    addStateListener(listener: (state: ConnectionState) => void): () => void {
        this.stateListeners.add(listener);
        return () => this.stateListeners.delete(listener);
    }

    private setConnectionState(state: ConnectionState) {
        this.connectionState = state;
        this.stateListeners.forEach(cb => cb(state));
    }

    private async post(endpoint: string, body: ApiRequest = {}): Promise<any> {
        const res = await fetch(`${BACKEND_URL}/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return res.json();
    }

    async get(endpoint: string, params: Record<string, string | number | boolean> = {}): Promise<any> {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        const res = await fetch(`${BACKEND_URL}/api/${endpoint}?${query}`);
        return res.json();
    }

    // API Methods
    async open_file(fileId: string, path: string) { return this.post('open_file', { file_id: fileId, file_path: path }); }
    async close_file(fileId: string) { return this.post('close_file', { file_id: fileId }); }
    async select_files() { return JSON.stringify(await this.get('select_files')); }
    async select_folder() { return this.get('select_folder'); }
    async has_native_dialogs() { return this.get('has_native_dialogs'); }
    async list_logs_in_folder(path: string) { return JSON.stringify(await this.get('list_logs_in_folder', { folder_path: path })); }
    async list_directory(path: string) { return JSON.stringify(await this.get('list_directory', { folder_path: path })); }
    async save_workspace_config(path: string, json: string) { return this.post('save_workspace_config', { folder_path: path, config_json: json }); }
    async load_workspace_config(path: string) { return this.get('load_workspace_config', { folder_path: path }); }
    async ready() { return this.post('ready'); }
    async sync_layers(fileId: string, json: string) { return this.post('sync_layers', { file_id: fileId, layers_json: json }); }
    async sync_decorations(fileId: string, json: string) {
        return this.post('sync_decorations', { file_id: fileId, layers_json: json });
    }
    async sync_all(fileId: string, layersJson: string, searchJson: string) {
        return this.post('sync_all', { file_id: fileId, layers_json: layersJson, search_json: searchJson });
    }
    async read_processed_lines(fileId: string, start: number, count: number) {
        const res = await this.get('read_processed_lines', { file_id: fileId, start_line: start, count: count });
        return JSON.stringify(res);
    }
    async search_ripgrep(fileId: string, query: string, regex: boolean, caseSensitive: boolean) {
        return this.post('search_ripgrep', { file_id: fileId, query, regex, case_sensitive: caseSensitive });
    }
    async get_search_match_index(fileId: string, rank: number) {
        return this.get('get_search_match_index', { file_id: fileId, rank });
    }
    async get_nearest_search_rank(fileId: string, currentIndex: number, direction: string) {
        return this.get('get_nearest_search_rank', { file_id: fileId, current_index: currentIndex, direction });
    }
    async get_search_matches_range(fileId: string, start: number, count: number) {
        const res = await this.get('get_search_matches_range', { file_id: fileId, start_rank: start, count: count });
        return JSON.stringify(res);
    }
    async is_search_match(fileId: string, index: number) {
        return this.get('is_search_match', { file_id: fileId, index });
    }
    async get_layer_registry() { return JSON.stringify(await this.get('get_layer_registry')); }
    async reload_plugins() { return this.post('reload_plugins'); }
    async get_platform_info() { return this.get('platform'); }
    async get_log_level_stats(fileId: string) { return this.get('log_level_stats', { file_id: fileId }); }

    // Bookmark APIs
    async toggle_bookmark(fileId: string, lineIndex: number) {
        return this.post('toggle_bookmark', { file_id: fileId, line_index: lineIndex });
    }
    async get_bookmarks(fileId: string) {
        return this.get('get_bookmarks', { file_id: fileId });
    }
    async get_nearest_bookmark_index(fileId: string, currentIndex: number, direction: string) {
        return this.get('get_nearest_bookmark_index', { file_id: fileId, current_index: currentIndex, direction });
    }
    async clear_bookmarks(fileId: string) {
        return this.post('clear_bookmarks', { file_id: fileId });
    }
    async get_lines_by_indices(fileId: string, indices: number[]) {
        return this.post('get_lines_by_indices', { file_id: fileId, indices });
    }
    async update_bookmark_comment(fileId: string, lineIndex: number, comment: string) {
        return this.post('update_bookmark_comment', { file_id: fileId, line_index: lineIndex, comment: comment });
    }
    async physical_to_visual_index(fileId: string, physicalIndex: number) {
        return this.get('physical_to_visual_index', { file_id: fileId, physical_index: physicalIndex });
    }
    
    // Pattern detection APIs
    async analyze_log_pattern(fileId: string, sampleSize: number = 100) {
        return this.get('analyze_log_pattern', { file_id: fileId, sample_size: sampleSize });
    }
    
    async suggest_layers(fileId: string) {
        return this.get('suggest_layers', { file_id: fileId });
    }

    // Export API
    async export_visible_lines(fileId: string, outputPath: string, format: string) {
        return this.post('export_visible_lines', { file_id: fileId, output_path: outputPath, format });
    }

    // Worker config APIs
    async get_worker_config() {
        return this.get('worker_config');
    }

    async set_worker_config(config: { max_workers: number }) {
        return this.post('worker_config', config);
    }
}

/**
 * 确保桥接实例已创建。
 */
export const ensureBridge = (): Promise<FileBridgeAPI | null> => {
    if (fileBridge) return Promise.resolve(fileBridge);
    if (initPromise) return initPromise;
    initPromise = new Promise((resolve) => {
        const bridge = new WebBridge();
        fileBridge = (bridge as unknown) as FileBridgeAPI;
        window.fileBridge = fileBridge;
        resolve(fileBridge);
    });
    return initPromise;
};

export const initBridge = ensureBridge;

// Existing helper exports maintained for compatibility
export async function readProcessedLines(fileId: string, start: number, count: number): Promise<Array<{index: number, content: string, highlights?: Array<{start: number, end: number, color: string, opacity: number}>}>> {
    if (!fileBridge) return [];
    try {
        const jsonStr = await fileBridge.read_processed_lines(fileId, start, count);
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error(`Failed to read processed lines:`, e);
        return [];
    }
}

export async function syncAll(fileId: string, layers: any[], search: any): Promise<void> {
    if (!fileBridge) return;
    fileBridge.sync_all(fileId, JSON.stringify(layers), JSON.stringify(search));
}

/**
 * 仅同步渲染层配置 (快速响应，不重跑 Pipeline)
 */
export async function syncDecorations(fileId: string, layers: any[]): Promise<void> {
    if (!fileBridge) return;
    await fileBridge.sync_decorations(fileId, JSON.stringify(layers));
}

export async function searchRipgrep(fileId: string, query: string, regex: boolean = false, caseSensitive: boolean = false): Promise<boolean> {
    if (!fileBridge) return false;
    return fileBridge.search_ripgrep(fileId, query, regex, caseSensitive);
}

export async function getSearchMatchIndex(fileId: string, rank: number): Promise<number> {
    if (!fileBridge) return -1;
    return await fileBridge.get_search_match_index(fileId, rank);
}

export async function getNearestSearchRank(fileId: string, currentIndex: number, direction: 'next' | 'prev'): Promise<number> {
    if (!fileBridge) return -1;
    return await fileBridge.get_nearest_search_rank(fileId, currentIndex, direction);
}

export async function isSearchMatch(fileId: string, index: number): Promise<boolean> {
    if (!fileBridge) return false;
    return await fileBridge.is_search_match(fileId, index);
}

export async function getLayerRegistry(): Promise<string> {
    const bridge = await ensureBridge();
    if (!bridge) return "[]";
    return await bridge.get_layer_registry();
}

export async function reloadPlugins(): Promise<boolean> {
    if (!fileBridge) return false;
    return await fileBridge.reload_plugins();
}

export async function getPlatformInfo(): Promise<string> {
    if (!fileBridge) return "Unknown";
    return await fileBridge.get_platform_info();
}

export async function getLogLevelStats(fileId: string): Promise<Record<string, number>> {
    if (!fileBridge) return {};
    try {
        return await fileBridge.get_log_level_stats(fileId);
    } catch (e) {
        console.error('[Bridge] get_log_level_stats error:', e);
        return {};
    }
}

export async function analyzeLogPattern(fileId: string, sampleSize: number = 100): Promise<any> {
    if (!fileBridge) return {};
    try {
        return await fileBridge.get('analyze_log_pattern', { file_id: fileId, sample_size: sampleSize });
    } catch (e) {
        console.error('[Bridge] analyze_log_pattern error:', e);
        return {};
    }
}

export async function suggestLayers(fileId: string): Promise<any> {
    if (!fileBridge) return { suggestions: [] };
    try {
        return await fileBridge.get('suggest_layers', { file_id: fileId });
    } catch (e) {
        console.error('[Bridge] suggest_layers error:', e);
        return { suggestions: [] };
    }
}

export function signalReady(): void {
    if (fileBridge) fileBridge.ready();
}

export async function getSearchMatchesRange(fileId: string, startRank: number, count: number): Promise<number[]> {
    if (!fileBridge) return [];
    try {
        const json = await fileBridge.get_search_matches_range(fileId, startRank, count);
        return JSON.parse(json);
    } catch (e) { return []; }
}

export async function openFile(fileId: string, path: string): Promise<boolean> {
    if (!fileBridge) return false;
    return fileBridge.open_file(fileId, path);
}

export async function closeFile(fileId: string): Promise<void> {
    if (!fileBridge) return;
    return fileBridge.close_file(fileId);
}

export async function selectFiles(): Promise<string[]> {
    if (!fileBridge) return [];
    try {
        const jsonStr = await fileBridge.select_files();
        return JSON.parse(jsonStr);
    } catch (e) { return []; }
}

export async function selectFolder(): Promise<string> {
    if (!fileBridge) return "";
    return fileBridge.select_folder();
}

export async function hasNativeDialogs(): Promise<boolean> {
    if (!fileBridge) return false;
    try {
        return await fileBridge.has_native_dialogs();
    } catch {
        return false;
    }
}

export async function listLogsInFolder(folderPath: string): Promise<any[]> {
    if (!fileBridge) return [];
    try {
        const jsonStr = await fileBridge.list_logs_in_folder(folderPath);
        return JSON.parse(jsonStr);
    } catch (e) { return []; }
}

export async function listDirectory(folderPath: string): Promise<any[]> {
    if (!fileBridge) return [];
    try {
        const jsonStr = await fileBridge.list_directory(folderPath);
        return JSON.parse(jsonStr);
    } catch (e) { return []; }
}

export interface WorkspaceConfig {
    version: number;
    lastModified: string;
    files?: Array<{ path: string; name: string; size: number; layers: any[] }>;
    activeFilePath?: string | null;
    layers?: any[];
}

export async function saveWorkspaceConfig(folderPath: string, config: WorkspaceConfig): Promise<boolean> {
    if (!fileBridge) return false;
    return await fileBridge.save_workspace_config(folderPath, JSON.stringify(config));
}

export async function loadWorkspaceConfig(folderPath: string): Promise<WorkspaceConfig | null> {
    if (!fileBridge) return null;
    try {
        const jsonStr = await fileBridge.load_workspace_config(folderPath);
        if (!jsonStr) return null;
        return JSON.parse(jsonStr) as WorkspaceConfig;
    } catch (e) { return null; }
}

// ============================================================
// 书签 API (Bookmark APIs)
// ============================================================

/**
 * 切换指定行的书签状态
 * @returns 更新后的书签对象 {lineIndex: comment}
 */
export async function toggleBookmark(fileId: string, lineIndex: number): Promise<Record<number, string>> {
    if (!fileBridge) return {};
    try {
        const res = await fileBridge.toggle_bookmark(fileId, lineIndex);
        return typeof res === 'string' ? JSON.parse(res) : res;
    } catch (e) {
        console.error('[Bridge] toggleBookmark error:', e);
        return {};
    }
}

/**
 * 获取当前文件的书签列表
 */
export async function getBookmarks(fileId: string): Promise<Record<number, string>> {
    if (!fileBridge) return {};
    try {
        const res = await fileBridge.get_bookmarks(fileId);
        return typeof res === 'string' ? JSON.parse(res) : res;
    } catch (e) {
        console.error('[Bridge] getBookmarks error:', e);
        return {};
    }
}

/**
 * 获取最近的书签索引
 */
export async function getNearestBookmarkIndex(fileId: string, currentIndex: number, direction: 'next' | 'prev'): Promise<number> {
    if (!fileBridge) return -1;
    try {
        return await fileBridge.get_nearest_bookmark_index(fileId, currentIndex, direction);
    } catch (e) {
        console.error('[Bridge] getNearestBookmarkIndex error:', e);
        return -1;
    }
}

/**
 * 清除指定文件的所有书签
 */
export async function clearBookmarks(fileId: string): Promise<Record<number, string>> {
    if (!fileBridge) return {};
    try {
        const res = await fileBridge.clear_bookmarks(fileId);
        return typeof res === 'string' ? JSON.parse(res) : res;
    } catch (e) {
        console.error('[Bridge] clearBookmarks error:', e);
        return {};
    }
}

/**
 * 更新书签注释
 */
export async function updateBookmarkComment(fileId: string, lineIndex: number, comment: string): Promise<Record<number, string>> {
    const bridge = await ensureBridge();
    if (!bridge) return {};
    try {
        const res = await bridge.update_bookmark_comment(fileId, lineIndex, comment);
        return typeof res === 'string' ? JSON.parse(res) : res;
    } catch (e) {
        console.error('[Bridge] updateBookmarkComment error:', e);
        return {};
    }
}

/**
 * 获取指定索引的行内容（纯文本）
 */
export async function getLinesByIndices(fileId: string, indices: number[]): Promise<{ index: number; text: string }[]> {
    if (!fileBridge) return [];
    try {
        const res = await fileBridge.get_lines_by_indices(fileId, indices);
        return typeof res === 'string' ? JSON.parse(res) : res;
    } catch (e) {
        console.error('[Bridge] getLinesByIndices error:', e);
        return [];
    }
}

/**
 * 将物理行索引转换为虚拟行索引
 */
export async function physicalToVisualIndex(fileId: string, physicalIndex: number): Promise<number> {
    if (!fileBridge) return physicalIndex;
    try {
        const res = await fileBridge.physical_to_visual_index(fileId, physicalIndex);
        return typeof res === 'number' ? res : physicalIndex;
    } catch (e) {
        console.error('[Bridge] physicalToVisualIndex error:', e);
        return physicalIndex;
    }
}

/**
 * 导出日志
 */
export interface ExportOptions {
    fileId: string;
    outputPath: string;
    format: 'txt' | 'csv' | 'json';
    includeLineNumbers?: boolean;
    includeTimestamps?: boolean;
}

export async function exportVisibleLines(options: ExportOptions): Promise<{ success: boolean; error?: string }> {
    if (!fileBridge) return { success: false, error: 'Bridge not initialized' };
    try {
        const result = await fileBridge.export_visible_lines(
            options.fileId,
            options.outputPath,
            options.format
        );
        return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (e) {
        console.error('[Bridge] exportVisibleLines error:', e);
        return { success: false, error: String(e) };
    }
}

/**
 * 获取 Worker 配置
 */
export async function getWorkerConfig(): Promise<{ maxWorkers: number; currentWorkers: number }> {
    if (!fileBridge) return { maxWorkers: 4, currentWorkers: 2 };
    try {
        const res = await fileBridge.get_worker_config();
        return typeof res === 'string' ? JSON.parse(res) : res;
    } catch (e) {
        console.error('[Bridge] getWorkerConfig error:', e);
        return { maxWorkers: 4, currentWorkers: 2 };
    }
}

/**
 * 设置 Worker 配置
 */
export async function setWorkerConfig(maxWorkers: number): Promise<boolean> {
    if (!fileBridge) return false;
    try {
        await fileBridge.set_worker_config({ max_workers: maxWorkers });
        return true;
    } catch (e) {
        console.error('[Bridge] setWorkerConfig error:', e);
        return false;
    }
}

export interface SystemMetrics {
    cpu_percent: number;
    memory_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
    disk_read_bytes?: number;
    disk_write_bytes?: number;
    disk_read_count?: number;
    disk_write_count?: number;
    disk_read_time_ms?: number;
    disk_write_time_ms?: number;
    error?: string;
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
    if (!fileBridge) return { cpu_percent: 0, memory_percent: 0, memory_used_mb: 0, memory_total_mb: 0, error: 'Bridge not initialized' };
    try {
        return await fileBridge.get('system_metrics');
    } catch (e) {
        console.error('[Bridge] getSystemMetrics error:', e);
        return { cpu_percent: 0, memory_percent: 0, memory_used_mb: 0, memory_total_mb: 0, error: String(e) };
    }
}
