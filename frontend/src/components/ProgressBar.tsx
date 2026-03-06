import React from 'react';

interface ProgressBarProps {
  isProcessing: boolean;
  isLayerProcessing: boolean;
  loadingProgress: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  isProcessing,
  isLayerProcessing,
  loadingProgress
}) => {
  return (
    <div className="absolute top-9 left-0 right-0 h-0.5 z-50 pointer-events-none">
      {(isProcessing || isLayerProcessing) && (
        <div 
          className={`h-full bg-blue-500 transition-all duration-300 ${isLayerProcessing ? 'animate-pulse' : ''}`}
          style={{ width: isLayerProcessing ? '100%' : `${loadingProgress}%` }} 
        />
      )}
    </div>
  );
};
