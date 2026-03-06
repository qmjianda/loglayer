import React from 'react';
import { SidebarPanel } from './SidebarPanel';

interface SidebarContainerProps {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  responsive: { isMobile: boolean };
  children: React.ReactNode;
}

export const SidebarContainer: React.FC<SidebarContainerProps> = ({
  sidebarWidth,
  setSidebarWidth,
  responsive,
  children
}) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, startWidth + (moveEvent.clientX - startX)));
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={`bg-secondary border-r border-subtle flex flex-col shrink-0 shadow-lg relative group/sidebar 
        ${responsive.isMobile ? 'absolute inset-y-0 left-10 z-40' : ''}`}
      style={{ 
        width: responsive.isMobile ? (sidebarWidth > 0 ? sidebarWidth : 280) : sidebarWidth,
        display: responsive.isMobile && sidebarWidth === 0 ? 'none' : 'flex'
      }}
    >
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors opacity-0 group-hover/sidebar:opacity-100"
        onMouseDown={handleMouseDown}
      />
      {children}
    </div>
  );
};