/**
 * ContextMenu - Radix UI based context menu for LogViewer
 *
 * Provides keyboard-accessible context menu with Copy, Highlight, Filter, Bookmark options.
 */

import React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { Copy, Highlighter, Filter, Bookmark, BookmarkCheck } from 'lucide-react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

export interface ContextMenuGroup {
  id: string;
  label?: string;
  items: ContextMenuItem[];
}

export interface ContextMenuProps {
  trigger: React.ReactNode;
  groups?: ContextMenuGroup[];
  onCopy?: (text: string) => void;
  onAddHighlight?: (query: string) => void;
  onAddFilter?: (query: string) => void;
  onToggleBookmark?: (lineIndex: number) => void;
  selectedText?: string;
  lineIndex?: number;
  isBookmarked?: boolean;
}

const ContextMenuContent = React.forwardRef<
  HTMLDivElement,
  ContextMenuPrimitive.ContextMenuContentProps & { children?: React.ReactNode }
>(({ children, className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={`
                min-w-[180px] 
                bg-[var(--bg-elevated)] 
                border border-[var(--border-default)]
                rounded-md 
                p-1 
                shadow-lg
                animate-in fade-in-0 zoom-in-95
                data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
            `}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
));

ContextMenuContent.displayName = 'ContextMenuContent';

const ContextMenuItem = React.forwardRef<
  HTMLDivElement,
  ContextMenuPrimitive.ContextMenuItemProps & {
    children?: React.ReactNode;
    danger?: boolean;
  }
>(({ children, className, danger, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={`
            flex items-center gap-2
            px-2 py-1.5 
            text-sm 
            rounded 
            outline-none
            cursor-pointer
            transition-colors duration-100
            ${
              danger
                ? 'text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white'
                : 'text-[var(--fg-primary)] hover:bg-[var(--bg-tertiary)]'
            }
            focus:bg-[var(--bg-tertiary)]
            data-[disabled]:opacity-50 data-[disabled]:pointer-events-none
            ${className || ''}
        `}
    {...props}
  >
    {children}
  </ContextMenuPrimitive.Item>
));

ContextMenuItem.displayName = 'ContextMenuItem';

const ContextMenuSeparator = React.forwardRef<
  HTMLDivElement,
  ContextMenuPrimitive.ContextMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={`h-[1px] bg-[var(--border-subtle)] my-1 ${className || ''}`}
    {...props}
  />
));

ContextMenuSeparator.displayName = 'ContextMenuSeparator';

export const ContextMenu: React.FC<ContextMenuProps> = ({
  trigger,
  groups,
  onCopy,
  onAddHighlight,
  onAddFilter,
  onToggleBookmark,
  selectedText = '',
  lineIndex,
  isBookmarked = false,
}) => {
  const hasSelection = selectedText.length > 0;
  const hasLine = lineIndex !== undefined;

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{trigger}</ContextMenuPrimitive.Trigger>

      <ContextMenuContent>
        {/* Copy */}
        <ContextMenuItem disabled={!hasSelection} onClick={() => onCopy?.(selectedText)}>
          <Copy size={14} />
          <span>Copy</span>
          <span className="ml-auto text-xs text-[var(--fg-muted)]">Ctrl+C</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Highlight */}
        <ContextMenuItem disabled={!hasSelection} onClick={() => onAddHighlight?.(selectedText)}>
          <Highlighter size={14} />
          <span>Add Highlight</span>
        </ContextMenuItem>

        {/* Filter */}
        <ContextMenuItem disabled={!hasSelection} onClick={() => onAddFilter?.(selectedText)}>
          <Filter size={14} />
          <span>Add Filter</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Bookmark */}
        <ContextMenuItem disabled={!hasLine} onClick={() => onToggleBookmark?.(lineIndex!)}>
          {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          <span>{isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPrimitive.Root>
  );
};

export { ContextMenuPrimitive };
export default ContextMenu;
