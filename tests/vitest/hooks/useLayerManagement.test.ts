import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayerManagement } from '../../../frontend/src/hooks/useLayerManagement';
import { LayerType } from '../../../frontend/src/types';
import type { FileData } from '../../../frontend/src/hooks/useFileManagement';

vi.mock('../../../frontend/src/hooks/useLayerRegistry', () => ({
    useLayerRegistry: () => ({
        registry: {
            FILTER: { type: 'FILTER', display_name: 'Filter', icon: 'filter', ui_schema: [{ name: 'query', value: '' }], is_builtin: true },
            HIGHLIGHT: { type: 'HIGHLIGHT', display_name: 'Highlight', icon: 'zap', ui_schema: [{ name: 'query', value: '' }], is_builtin: true },
            LEVEL: { type: 'LEVEL', display_name: 'Level', icon: 'alertTriangle', ui_schema: [{ name: 'levels', value: [] }], is_builtin: true },
            FOLDER: { type: 'FOLDER', display_name: 'Folder', icon: 'folder', ui_schema: [], is_builtin: true },
        },
        loading: false,
        refresh: vi.fn(),
    }),
}));

describe('hooks/useLayerManagement', () => {
    let mockFiles: FileData[];
    let mockSetFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
    let mockLocalStorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockFiles = [{
            id: 'test-file-1',
            name: 'test.log',
            size: 1000,
            lineCount: 100,
            rawCount: 100,
            layers: [],
            isBridged: true,
            path: '/test/test.log',
            history: { past: [], future: [] },
        }];

        mockSetFiles = vi.fn(((updater: React.SetStateAction<FileData[]>) => {
            if (typeof updater === 'function') {
                mockFiles = (updater as (prev: FileData[]) => FileData[])(mockFiles);
            } else {
                mockFiles = updater;
            }
        }) as React.Dispatch<React.SetStateAction<FileData[]>>);

        mockLocalStorage = {
            getItem: vi.fn().mockReturnValue(null),
            setItem: vi.fn(),
        };
        vi.stubGlobal('localStorage', mockLocalStorage);
        vi.stubGlobal('prompt', vi.fn().mockReturnValue('Test Preset'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('should return empty layers when no active file', () => {
        const { result } = renderHook(() => useLayerManagement({
            activeFileId: null,
            activeFile: undefined,
            files: [],
            setFiles: mockSetFiles,
            searchQuery: '',
            searchConfig: { regex: false, caseSensitive: false },
        }));

        expect(result.current.layers).toEqual([]);
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });

    it('should return layers from active file', () => {
        const testLayers = [
            { id: '1', name: 'Filter', type: LayerType.FILTER, enabled: true, config: {} },
        ];
        mockFiles[0].layers = testLayers;

        const { result } = renderHook(() => useLayerManagement({
            activeFileId: 'test-file-1',
            activeFile: mockFiles[0],
            files: mockFiles,
            setFiles: mockSetFiles,
            searchQuery: '',
            searchConfig: { regex: false, caseSensitive: false },
        }));

        expect(result.current.layers).toEqual(testLayers);
    });

    it('should add a new layer', () => {
        const { result } = renderHook(() => useLayerManagement({
            activeFileId: 'test-file-1',
            activeFile: mockFiles[0],
            files: mockFiles,
            setFiles: mockSetFiles,
            searchQuery: '',
            searchConfig: { regex: false, caseSensitive: false },
        }));

        act(() => {
            result.current.addLayer(LayerType.FILTER);
        });

        expect(mockSetFiles).toHaveBeenCalled();
    });

    it('should add a folder layer', () => {
        const { result } = renderHook(() => useLayerManagement({
            activeFileId: 'test-file-1',
            activeFile: mockFiles[0],
            files: mockFiles,
            setFiles: mockSetFiles,
            searchQuery: '',
            searchConfig: { regex: false, caseSensitive: false },
        }));

        act(() => {
            result.current.addLayer(LayerType.FOLDER);
        });

        expect(mockSetFiles).toHaveBeenCalled();
    });

    it('should update layers', () => {
        const { result } = renderHook(() => useLayerManagement({
            activeFileId: 'test-file-1',
            activeFile: mockFiles[0],
            files: mockFiles,
            setFiles: mockSetFiles,
            searchQuery: '',
            searchConfig: { regex: false, caseSensitive: false },
        }));

        act(() => {
            result.current.updateLayers([{ id: '1', name: 'Test', type: LayerType.FILTER, enabled: true, config: {} }]);
        });

        expect(mockSetFiles).toHaveBeenCalled();
    });

    it('should compute layersFunctionalHash', () => {
        mockFiles[0].layers = [
            { id: '1', name: 'Filter', type: LayerType.FILTER, enabled: true, config: { query: 'test' } },
        ];

        const { result } = renderHook(() => useLayerManagement({
            activeFileId: 'test-file-1',
            activeFile: mockFiles[0],
            files: mockFiles,
            setFiles: mockSetFiles,
            searchQuery: '',
            searchConfig: { regex: false, caseSensitive: false },
        }));

        expect(result.current.layersFunctionalHash).toContain('1');
        expect(result.current.layersFunctionalHash).toContain('FILTER');
    });

    it('should set selected layer id', () => {
        const { result } = renderHook(() => useLayerManagement({
            activeFileId: 'test-file-1',
            activeFile: mockFiles[0],
            files: mockFiles,
            setFiles: mockSetFiles,
            searchQuery: '',
            searchConfig: { regex: false, caseSensitive: false },
        }));

        act(() => {
            result.current.setSelectedLayerId('layer-1');
        });

        expect(result.current.selectedLayerId).toBe('layer-1');
    });

    it('should load presets from localStorage', () => {
        const savedPresets = [{ id: 'preset-1', name: 'Saved', layers: [] }];
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedPresets));

        const { result } = renderHook(() => useLayerManagement({
            activeFileId: 'test-file-1',
            activeFile: mockFiles[0],
            files: mockFiles,
            setFiles: mockSetFiles,
            searchQuery: '',
            searchConfig: { regex: false, caseSensitive: false },
        }));

        expect(result.current.presets.length).toBeGreaterThan(0);
    });
});