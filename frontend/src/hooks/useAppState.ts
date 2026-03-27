import { useMemo, useCallback } from 'react';
import { useWorkspace, useActiveFile, useActivePane } from '../contexts/WorkspaceContext';
import { FileData, Pane } from '../hooks/useFileManagement';
import { findPaneRecursive, updatePaneInTree } from '../hooks/useFileManagement';

export interface AppStateReturn {
    files: FileData[];
    activeFile: FileData | undefined;
    activePane: Pane | undefined;
    activeFileId: string | null;
    activePaneId: string | null;
    panes: Pane[];
    setFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
    setActiveFileId: (id: string | null) => void;
    setActivePaneId: (id: string | null) => void;
    updatePane: (paneId: string, update: Partial<Pane>) => void;
    getPane: (paneId: string) => Pane | undefined;
}

export function useAppState(): AppStateReturn {
    const workspace = useWorkspace();
    
    const activeFile = useActiveFile();
    const activePane = useActivePane();
    
    const updatePane = useCallback((paneId: string, update: Partial<Pane>) => {
        workspace.setPanes(prev => updatePaneInTree(prev, paneId, p => ({ ...p, ...update })));
    }, [workspace.setPanes]);
    
    const getPane = useCallback((paneId: string) => {
        return findPaneRecursive(workspace.panes, paneId);
    }, [workspace.panes]);
    
    return useMemo(() => ({
        files: workspace.files,
        activeFile,
        activePane,
        activeFileId: workspace.activeFileId,
        activePaneId: workspace.activePaneId,
        panes: workspace.panes,
        setFiles: workspace.setFiles,
        setPanes: workspace.setPanes,
        setActiveFileId: workspace.setActiveFileId,
        setActivePaneId: workspace.setActivePaneId,
        updatePane,
        getPane
    }), [
        workspace.files,
        activeFile,
        activePane,
        workspace.activeFileId,
        workspace.activePaneId,
        workspace.panes,
        workspace.setFiles,
        workspace.setPanes,
        workspace.setActiveFileId,
        workspace.setActivePaneId,
        updatePane,
        getPane
    ]);
}