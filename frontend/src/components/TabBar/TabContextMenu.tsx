/**
 * TabContextMenu - Context menu for tab operations
 * 
 * Provides Close, Close Others, Close All, Split Right, Split Down options.
 */

import React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { X, Columns, Rows } from 'lucide-react';

export interface TabContextMenuProps {
    trigger: React.ReactNode;
    onClose: () => void;
    onCloseOthers: () => void;
    onCloseAll: () => void;
    onSplitRight: () => void;
    onSplitDown: () => void;
    canClose: boolean;
}

const TabContextMenuContent = React.forwardRef<
    HTMLDivElement,
    ContextMenuPrimitive.ContextMenuContentProps & { children?: React.ReactNode }
>(({ children, className, ...props }, ref) => (
    <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
            ref={ref}
            className={`
                min-w-[160px] 
                bg-[var(--bg-elevated)] 
                border border-[var(--border-default)]
                rounded-md 
                p-1 
                shadow-lg
                animate-in fade-in-0 zoom-in-95
                data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
                z-50
            `}
            {...props}
        >
            {children}
        </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
));

TabContextMenuContent.displayName = 'TabContextMenuContent';

const TabMenuItem = React.forwardRef<
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
            ${danger 
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

TabMenuItem.displayName = 'TabMenuItem';

const TabMenuSeparator = React.forwardRef<
    HTMLDivElement,
    ContextMenuPrimitive.ContextMenuSeparatorProps
>((props, ref) => (
    <ContextMenuPrimitive.Separator
        ref={ref}
        className="h-[1px] bg-[var(--border-subtle)] my-1"
        {...props}
    />
));

TabMenuSeparator.displayName = 'TabMenuSeparator';

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
    trigger,
    onClose,
    onCloseOthers,
    onCloseAll,
    onSplitRight,
    onSplitDown,
    canClose = true,
}) => {
    return (
        <ContextMenuPrimitive.Root>
            <ContextMenuPrimitive.Trigger asChild>
                {trigger}
            </ContextMenuPrimitive.Trigger>
            
            <TabContextMenuContent>
                <TabMenuItem
                    disabled={!canClose}
                    onClick={onClose}
                >
                    <X size={14} />
                    <span>Close</span>
                    <span className="ml-auto text-xs text-[var(--fg-muted)]">Alt+W</span>
                </TabMenuItem>

                <TabMenuItem onClick={onCloseOthers}>
                    <X size={14} />
                    <span>Close Others</span>
                </TabMenuItem>

                <TabMenuItem onClick={onCloseAll}>
                    <X size={14} />
                    <span>Close All</span>
                </TabMenuItem>

                <TabMenuSeparator />

                <TabMenuItem onClick={onSplitRight}>
                    <Columns size={14} />
                    <span>Split Right</span>
                </TabMenuItem>

                <TabMenuItem onClick={onSplitDown}>
                    <Rows size={14} />
                    <span>Split Down</span>
                </TabMenuItem>
            </TabContextMenuContent>
        </ContextMenuPrimitive.Root>
    );
};

export default TabContextMenu;