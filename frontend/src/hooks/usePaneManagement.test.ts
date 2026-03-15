import { describe, it, expect } from 'vitest';
import { MAX_PANES, Pane } from '../hooks/usePaneManagement';

// Test the split logic functions
function splitPaneInTree(
    panes: Pane[],
    sourcePaneId: string,
    newPane: Pane,
    position: string | undefined,
    isHorizontal: boolean
): Pane[] {
    const newDirection = isHorizontal ? 'horizontal' : 'vertical';

    function splitInTree(items: Pane[], parentDirection?: string): Pane[] {
        const result: Pane[] = [];
        let processed = false;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (item.id === sourcePaneId) {
                processed = true;
                const sourcePane = item;

                if (parentDirection && parentDirection === newDirection) {
                    if (position === 'right' || position === 'bottom') {
                        result.push(sourcePane);
                        result.push(newPane);
                    } else {
                        result.push(newPane);
                        result.push(sourcePane);
                    }
                } else {
                    const children = position === 'right' || position === 'bottom'
                        ? [sourcePane, newPane]
                        : [newPane, sourcePane];
                    result.push({
                        id: `group-test`,
                        openFileIds: [],
                        activeFileId: null,
                        direction: newDirection,
                        children
                    });
                }
            } else if (item.children && item.direction) {
                const newChildren = splitInTree(item.children, item.direction);
                if (newChildren !== item.children) {
                    processed = true;
                    if (newChildren.length === 1) {
                        result.push(newChildren[0]);
                    } else {
                        result.push({ ...item, children: newChildren });
                    }
                } else {
                    result.push(item);
                }
            } else {
                result.push(item);
            }
        }

        return processed ? result : items;
    }

    return splitInTree(panes);
}

describe('hooks/usePaneManagement', () => {
    describe('MAX_PANES', () => {
        it('should be 99 (no limit)', () => {
            expect(MAX_PANES).toBe(99);
        });

        it('should be a positive number', () => {
            expect(MAX_PANES).toBeGreaterThan(0);
        });
    });

    describe('Mixed Split Tests', () => {
        it('should create horizontal split on single pane', () => {
            const initialPanes: Pane[] = [
                { id: 'pane-1', openFileIds: ['file-1'], activeFileId: 'file-1' }
            ];

            const newPane: Pane = { id: 'pane-2', openFileIds: ['file-2'], activeFileId: 'file-2' };
            const result = splitPaneInTree(initialPanes, 'pane-1', newPane, 'right', true);

            expect(result.length).toBe(1);
            expect(result[0].direction).toBe('horizontal');
            expect(result[0].children?.length).toBe(2);
            expect(result[0].children?.[0].id).toBe('pane-1');
            expect(result[0].children?.[1].id).toBe('pane-2');
        });

        it('should create vertical split inside horizontal group (nested)', () => {
            // Start with horizontal group
            const initialPanes: Pane[] = [
                {
                    id: 'group-1',
                    direction: 'horizontal',
                    openFileIds: [],
                    activeFileId: null,
                    children: [
                        { id: 'pane-1', openFileIds: ['file-1'], activeFileId: 'file-1' },
                        { id: 'pane-2', openFileIds: ['file-2'], activeFileId: 'file-2' }
                    ]
                }
            ];

            const newPane: Pane = { id: 'pane-3', openFileIds: ['file-3'], activeFileId: 'file-3' };
            // Split pane-2 to bottom (vertical split)
            const result = splitPaneInTree(initialPanes, 'pane-2', newPane, 'bottom', false);

            // Result should be a nested structure
            expect(result.length).toBe(1);
            expect(result[0].direction).toBe('horizontal');
            expect(result[0].children?.length).toBe(2);
            // pane-1 stays as is
            expect(result[0].children?.[0].id).toBe('pane-1');
            // pane-2 should now be a vertical group with pane-2 and pane-3
            const pane2Container = result[0].children?.[1];
            expect(pane2Container?.direction).toBe('vertical');
            expect(pane2Container?.children?.length).toBe(2);
        });

        it('should add to existing group with same direction', () => {
            // Start with horizontal group
            const initialPanes: Pane[] = [
                {
                    id: 'group-1',
                    direction: 'horizontal',
                    openFileIds: [],
                    activeFileId: null,
                    children: [
                        { id: 'pane-1', openFileIds: ['file-1'], activeFileId: 'file-1' },
                        { id: 'pane-2', openFileIds: ['file-2'], activeFileId: 'file-2' }
                    ]
                }
            ];

            const newPane: Pane = { id: 'pane-3', openFileIds: ['file-3'], activeFileId: 'file-3' };
            // Split pane-2 to right (same horizontal direction)
            const result = splitPaneInTree(initialPanes, 'pane-2', newPane, 'right', true);

            // Should add directly to children, not create nested group
            expect(result.length).toBe(1);
            expect(result[0].direction).toBe('horizontal');
            expect(result[0].children?.length).toBe(3);
        });

        it('should create complex nested structure with multiple splits', () => {
            // Step 1: Start with single pane
            let panes: Pane[] = [
                { id: 'pane-1', openFileIds: ['file-1'], activeFileId: 'file-1' }
            ];

            // Step 2: Horizontal split
            panes = splitPaneInTree(panes, 'pane-1', 
                { id: 'pane-2', openFileIds: ['file-2'], activeFileId: 'file-2' },
                'right', true);

            // Step 3: Vertical split on pane-2
            panes = splitPaneInTree(panes, 'pane-2',
                { id: 'pane-3', openFileIds: ['file-3'], activeFileId: 'file-3' },
                'bottom', false);

            // Step 4: Horizontal split on pane-3
            panes = splitPaneInTree(panes, 'pane-3',
                { id: 'pane-4', openFileIds: ['file-4'], activeFileId: 'file-4' },
                'right', true);

            // Verify structure
            expect(panes.length).toBe(1);
            expect(panes[0].direction).toBe('horizontal');
            expect(panes[0].children?.length).toBe(2);
            
            // First child is pane-1
            expect(panes[0].children?.[0].id).toBe('pane-1');
            
            // Second child should be a vertical group
            const verticalGroup = panes[0].children?.[1];
            expect(verticalGroup?.direction).toBe('vertical');
            expect(verticalGroup?.children?.length).toBe(2);
            
            // Within vertical group, first is pane-2, second is horizontal group
            expect(verticalGroup?.children?.[0].id).toBe('pane-2');
            
            const horizontalSubgroup = verticalGroup?.children?.[1];
            expect(horizontalSubgroup?.direction).toBe('horizontal');
            expect(horizontalSubgroup?.children?.length).toBe(2);
            expect(horizontalSubgroup?.children?.[0].id).toBe('pane-3');
            expect(horizontalSubgroup?.children?.[1].id).toBe('pane-4');
        });
    });
});
