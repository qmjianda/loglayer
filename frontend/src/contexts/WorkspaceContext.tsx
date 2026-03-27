import React, { createContext, useContext, useMemo } from 'react';
import { FileData, Pane } from '../hooks/useFileManagement';

interface WorkspaceState {
    files: FileData[];
    panes: Pane[];
    activeFileId: string | null;
    activePaneId: string | null;
}

interface WorkspaceActions {
    setFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
    setActiveFileId: (id: string | null) => void;
    setActivePaneId: (id: string | null) => void;
}

type WorkspaceContextValue = WorkspaceState & WorkspaceActions;

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
    children: React.ReactNode;
    files: FileData[];
    panes: Pane[];
    activeFileId: string | null;
    activePaneId: string | null;
    setFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
    setActiveFileId: (id: string | null) => void;
    setActivePaneId: (id: string | null) => void;
}

export function WorkspaceProvider({
    children,
    files,
    panes,
    activeFileId,
    activePaneId,
    setFiles,
    setPanes,
    setActiveFileId,
    setActivePaneId
}: WorkspaceProviderProps) {
    const value = useMemo(() => ({
        files,
        panes,
        activeFileId,
        activePaneId,
        setFiles,
        setPanes,
        setActiveFileId,
        setActivePaneId
    }), [files, panes, activeFileId, activePaneId, setFiles, setPanes, setActiveFileId, setActivePaneId]);

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace(): WorkspaceContextValue {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}

export function useWorkspaceState(): WorkspaceState {
    const { files, panes, activeFileId, activePaneId } = useWorkspace();
    return useMemo(() => ({ files, panes, activeFileId, activePaneId }), [files, panes, activeFileId, activePaneId]);
}

export function useWorkspaceActions(): WorkspaceActions {
    const { setFiles, setPanes, setActiveFileId, setActivePaneId } = useWorkspace();
    return useMemo(() => ({ setFiles, setPanes, setActiveFileId, setActivePaneId }), [setFiles, setPanes, setActiveFileId, setActivePaneId]);
}

export function useActiveFile(): FileData | undefined {
    const { files, activeFileId } = useWorkspace();
    return useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);
}

export function useActivePane(): Pane | undefined {
    const { panes, activePaneId } = useWorkspace();
    
    function findPane(paneList: Pane[], targetId: string): Pane | undefined {
        for (const pane of paneList) {
            if (pane.id === targetId) return pane;
            if (pane.children) {
                const found = findPane(pane.children, targetId);
                if (found) return found;
            }
        }
        return undefined;
    }
    
    return useMemo(() => panes.length > 0 && activePaneId ? findPane(panes, activePaneId) : undefined, [panes, activePaneId]);
}

export { WorkspaceContext };
export type { WorkspaceState, WorkspaceActions, WorkspaceContextValue };