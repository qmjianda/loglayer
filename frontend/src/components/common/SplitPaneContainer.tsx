import React from 'react';

export interface SplitPaneContainerProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export const SplitPaneContainer: React.FC<SplitPaneContainerProps> = ({
    children,
    className = '',
    style
}) => {
    return (
        <div className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${className}`} style={style}>
            {children}
        </div>
    );
};

export default SplitPaneContainer;