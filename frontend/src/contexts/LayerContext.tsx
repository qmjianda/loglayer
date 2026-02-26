/**
 * LayerContext - Global layer state management
 * 
 * Provides centralized layer state for the application using React Context.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { LogLayer, LayerType } from '../types';

interface LayerContextValue {
    // Layer state
    layers: LogLayer[];
    setLayers: React.Dispatch<React.SetStateAction<LogLayer[]>>;
    
    // Layer operations
    addLayer: (layer: LogLayer) => void;
    removeLayer: (layerId: string) => void;
    updateLayer: (layerId: string, updates: Partial<LogLayer>) => void;
    reorderLayers: (startIndex: number, endIndex: number) => void;
    toggleLayer: (layerId: string) => void;
    
    // Utility
    getLayerById: (id: string) => LogLayer | undefined;
    getVisibleLayers: () => LogLayer[];
    getEnabledLayers: () => LogLayer[];
    clearAllLayers: () => void;
    
    // Hash for sync
    layersHash: string;
    layersFunctionalHash: string;
}

const LayerContext = createContext<LayerContextValue | null>(null);

export function LayerProvider({ children }: { children: React.ReactNode }) {
    const [layers, setLayers] = useState<LogLayer[]>([]);
    
    const addLayer = useCallback((layer: LogLayer) => {
        setLayers(prev => [...prev, layer]);
    }, []);
    
    const removeLayer = useCallback((layerId: string) => {
        setLayers(prev => prev.filter(l => l.id !== layerId));
    }, []);
    
    const updateLayer = useCallback((layerId: string, updates: Partial<LogLayer>) => {
        setLayers(prev => prev.map(l => 
            l.id === layerId ? { ...l, ...updates } : l
        ));
    }, []);
    
    const reorderLayers = useCallback((startIndex: number, endIndex: number) => {
        setLayers(prev => {
            const result = Array.from(prev);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return result;
        });
    }, []);
    
    const toggleLayer = useCallback((layerId: string) => {
        setLayers(prev => prev.map(l => 
            l.id === layerId ? { ...l, enabled: !l.enabled } : l
        ));
    }, []);
    
    const getLayerById = useCallback((id: string) => {
        return layers.find(l => l.id === id);
    }, [layers]);
    
    const getVisibleLayers = useCallback(() => {
        return layers.filter(l => l.enabled);
    }, [layers]);
    
    const getEnabledLayers = useCallback(() => {
        return layers.filter(l => l.enabled);
    }, [layers]);
    
    const clearAllLayers = useCallback(() => {
        setLayers([]);
    }, []);
    
    // Hash for detecting changes
    const layersHash = useMemo(() => {
        return layers.map(l => `${l.id}:${l.enabled}:${JSON.stringify(l.config)}`).join('|');
    }, [layers]);
    
    const layersFunctionalHash = useMemo(() => {
        return layers.filter(l => l.enabled)
            .map(l => `${l.id}:${JSON.stringify(l.config)}`)
            .join('|');
    }, [layers]);
    
    const value = useMemo<LayerContextValue>(() => ({
        layers,
        setLayers,
        addLayer,
        removeLayer,
        updateLayer,
        reorderLayers,
        toggleLayer,
        getLayerById,
        getVisibleLayers,
        getEnabledLayers,
        clearAllLayers,
        layersHash,
        layersFunctionalHash,
    }), [
        layers, addLayer, removeLayer, updateLayer, reorderLayers,
        toggleLayer, getLayerById, getVisibleLayers, getEnabledLayers,
        clearAllLayers, layersHash, layersFunctionalHash
    ]);
    
    return (
        <LayerContext.Provider value={value}>
            {children}
        </LayerContext.Provider>
    );
}

export function useLayerContext(): LayerContextValue {
    const context = useContext(LayerContext);
    if (!context) {
        throw new Error('useLayerContext must be used within a LayerProvider');
    }
    return context;
}

export { LayerContext };