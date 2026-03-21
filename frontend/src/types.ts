
/**
 * Shared Types - Frontend/Backend Communication
 * 
 * This file defines TypeScript types that mirror the Pydantic models
 * in backend/loglayer/schemas.py for type safety across the API boundary.
 * 
 * When updating types, ensure both files are kept in sync.
 */

// Mirror: backend/loglayer/schemas.py::LayerTypeEnum
export enum LayerType {
  FILTER = 'FILTER',
  HIGHLIGHT = 'HIGHLIGHT',
  RANGE = 'RANGE',
  MARK = 'MARK',
  TIME_RANGE = 'TIME_RANGE',
  LEVEL = 'LEVEL',
  TRANSFORM = 'TRANSFORM',
  EXTRACT = 'EXTRACT',
  FOLDER = 'FOLDER',
  PYTHON = 'PYTHON'
}

// Mirror: backend/loglayer/schemas.py::LayerUIField
export interface LayerUIField {
  name: string;
  type: 'str' | 'int' | 'bool' | 'dropdown' | 'color' | 'multiselect' | 'search' | 'range';
  display_name: string;
  value?: string | number | boolean | string[];
  info?: string;
  options?: Array<string | { label: string, value: string }>;
  min?: number;
  max?: number;
  // Search field specific options
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  // Show/hide option buttons
  showRegex?: boolean;
  showCaseSensitive?: boolean;
  showWholeWord?: boolean;
}

// Mirror: backend/loglayer/schemas.py::LayerRegistryEntry
export interface LayerRegistryEntry {
  type: string;
  display_name: string;
  description: string;
  icon: string;
  ui_schema: LayerUIField[];
  is_builtin: boolean;
  category?: string;  // FILTER, TRANSFORM, HIGHLIGHT, DECORATION, WIDGET
  stage?: string;     // LOGIC, RENDERING
}

// Mirror: backend/loglayer/schemas.py::LayerConfig
export interface LayerConfig {
  query?: string;
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  invert?: boolean;
  levels?: string[];
  color?: string;
  opacity?: number;
  [key: string]: any; // Allow custom fields for Python layers
}

// Mirror: backend/loglayer/schemas.py::LogLayer
export interface LogLayer {
  id: string;
  name: string;
  type: LayerType;
  enabled: boolean;
  isLocked?: boolean;
  isCollapsed?: boolean;
  groupId?: string;
  config: LayerConfig;
}

// Mirror: backend/loglayer/schemas.py::LayerPreset
export interface LayerPreset {
  id: string;
  name: string;
  layers: LogLayer[];
}

export interface LayerStats {
  count: number;
  distribution: number[];
}

export interface RowStyle {
  backgroundColor?: string;
  color?: string;
}

// Mirror: backend/loglayer/schemas.py::LogLine
export interface LogLine {
  index: number;
  content: string;
  displayContent?: string;
  highlights?: Array<{ start: number; end: number; color: string; opacity: number; isSearch?: boolean }>;
  isMarked?: boolean;
  bookmarkComment?: string;
  rowStyle?: RowStyle;
}

export interface ProcessedCache {
  searchMatchCount?: number;
  layerStats?: Record<string, { count: number; distribution: number[] }>;
}

export interface SearchConfigInput {
  regex: boolean;
  caseSensitive: boolean;
  wholeWord?: boolean;
}

export interface AppSettings {
  autoOpenLastFile: boolean;
  rememberWindowPosition: boolean;
  fileEncoding: string;
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  lineHeight: number;
  showLineNumbers: boolean;
  searchRegexDefault: boolean;
  searchCaseSensitiveDefault: boolean;
  searchHighlightAll: boolean;
  searchHistoryLimit: number;
  wordWrap: boolean;
  showWhitespace: boolean;
  virtualScrollBuffer: number;
  layerPresetDefault: string;
  syncLayersOnOpen: boolean;
  backendUrl: string;
  debugMode: boolean;
}

export type ResolvedTheme = 'dark' | 'light';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// --- Bridge Interface ---

export interface FileBridgeAPI {
  // File operations
  open_file(fileId: string, path: string): Promise<boolean>;
  close_file(fileId: string): Promise<void>;
  select_files(): Promise<string>;
  select_folder(): Promise<string>;
  list_logs_in_folder(folderPath: string): Promise<string>;
  list_directory(folderPath: string): Promise<string>;
  save_workspace_config(folderPath: string, configJson: string): Promise<boolean>;
  load_workspace_config(folderPath: string): Promise<string>;
  ready(): Promise<void>;

  // Bookmark operations
  toggle_bookmark(fileId: string, lineIndex: number): Promise<Record<number, string>>;
  get_bookmarks(fileId: string): Promise<Record<number, string>>;
  clear_bookmarks(fileId: string): Promise<Record<number, string>>;
  update_bookmark_comment(fileId: string, lineIndex: number, comment: string): Promise<Record<number, string>>;
  get_nearest_bookmark_index(fileId: string, currentIndex: number, direction: string): Promise<number>;
  get_lines_by_indices(fileId: string, indices: number[]): Promise<string>;
  physical_to_visual_index(fileId: string, physicalIndex: number): Promise<number>;

  // Pipeline operations
  sync_layers(fileId: string, layersJson: string): Promise<boolean>;
  sync_all(fileId: string, layersJson: string, searchJson: string): Promise<boolean>;
  sync_decorations(fileId: string, layersJson: string): Promise<boolean>;
  read_processed_lines(fileId: string, start: number, count: number): Promise<string>;

  // Platform operations
  has_native_dialogs(): Promise<boolean>;

  // Search operations
  search_ripgrep(fileId: string, query: string, regex: boolean, caseSensitive: boolean): Promise<boolean>;
  get_search_match_index(fileId: string, rank: number): Promise<number>;
  get_nearest_search_rank(fileId: string, currentIndex: number, direction: string): Promise<number>;
  get_next_search_match(fileId: string, currentIndex: number, direction: string): Promise<{ rank: number; index: number }>;
  get_search_matches_range(fileId: string, startRank: number, count: number): Promise<string>;
  is_search_match(fileId: string, index: number): Promise<boolean>;
  get_search_rank_for_index(fileId: string, index: number): Promise<number>;

  // Registry operations
  get_layer_registry(): Promise<string>;
  reload_plugins(): Promise<boolean>;
  get_platform_info(): Promise<string>;
  get_log_level_stats(fileId: string): Promise<Record<string, number>>;
  
  // Pattern detection operations
  get(endpoint: string, params?: Record<string, any>): Promise<any>;
  analyze_log_pattern(fileId: string, sampleSize?: number): Promise<any>;
  suggest_layers(fileId: string): Promise<any>;

  // Export operations
  export_visible_lines(fileId: string, outputPath: string, format: string): Promise<string>;

  // Worker configuration
  get_worker_config(): Promise<string>;
  set_worker_config(config: { max_workers: number }): Promise<void>;

  // Signals
  fileLoaded: { connect: (cb: (fileId: string, payloadJson: string) => void) => void };
  pipelineFinished: { connect: (cb: (fileId: string, newTotal: number, matchCount: number) => void) => void };
  statsFinished: { connect: (cb: (fileId: string, statsJson: string) => void) => void };
  operationStarted: { connect: (cb: (fileId: string, opName: string) => void) => void };
  operationProgress: { connect: (cb: (fileId: string, opName: string, p: number) => void) => void };
  operationError: { connect: (cb: (fileId: string, opName: string, msg: string) => void) => void };
  operationStatusChanged: { connect: (cb: (fileId: string, status: string, p: number) => void) => void };
  pendingFilesCount: { connect: (cb: (count: number) => void) => void };
  workspaceOpened: { connect: (cb: (path: string) => void) => void };
  frontendReady: { connect: (cb: () => void) => void };
}

declare global {
  interface Window {
    qt?: { webChannelTransport: { send: (msg: object) => void; on: (cb: (msg: object) => void) => void } };
    fileBridge?: FileBridgeAPI;
    __draggedLayerId?: string;
  }

  interface PerformanceMemory {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  }

  interface Performance {
    memory?: PerformanceMemory;
  }
}
