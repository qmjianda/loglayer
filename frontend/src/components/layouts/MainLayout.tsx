/**
 * MainLayout - Main application layout component
 *
 * Provides the main layout structure including sidebar, main content area,
 * and handles responsive layout.
 */

import React, { useState } from 'react';

export interface MainLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarWidth?: number;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export interface MainLayoutStyle {
  container: string;
  sidebar: string;
  main: string;
  content: string;
}

export const useMainLayout = (initialWidth = 250) => {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isResizing, setIsResizing] = useState(false);

  const toggleSidebar = () => setShowSidebar((prev) => !prev);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.max(150, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
    },
    [isResizing],
  );

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    sidebarWidth,
    setSidebarWidth,
    showSidebar,
    setShowSidebar,
    toggleSidebar,
    isResizing,
    handleMouseDown,
  };
};

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  sidebar,
  sidebarWidth = 250,
  showSidebar = true,
  onToggleSidebar,
}) => {
  const {
    sidebarWidth: width,
    showSidebar: visible,
    toggleSidebar,
    isResizing,
    handleMouseDown,
  } = useMainLayout(sidebarWidth);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Sidebar */}
      {visible && sidebar && (
        <>
          <aside
            className="flex-shrink-0 h-full bg-[var(--bg-secondary)] border-r border-[var(--border-default)]"
            style={{ width: width }}
          >
            {sidebar}
          </aside>

          {/* Resize Handle */}
          <div
            className={`w-1 h-full cursor-col-resize bg-transparent hover:bg-[var(--color-primary)] transition-colors ${
              isResizing ? 'bg-[var(--color-primary)]' : ''
            }`}
            onMouseDown={handleMouseDown}
          />
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">{children}</main>

      {/* Sidebar Toggle Button (when sidebar hidden) */}
      {!visible && (
        <button
          onClick={onToggleSidebar || toggleSidebar}
          className="absolute left-2 top-2 z-10 p-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Show Sidebar"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default MainLayout;
