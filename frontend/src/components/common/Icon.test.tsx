import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Icon, toIconName, IconName } from './Icon';

describe('components/common/Icon', () => {
    it('should render a valid icon', () => {
        render(<Icon name="filter" />);
        const svg = document.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should render with custom size', () => {
        render(<Icon name="search" size={24} />);
        const svg = document.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should render with custom className', () => {
        render(<Icon name="folder" className="text-blue-500" />);
        const svg = document.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.classList.contains('text-blue-500')).toBe(true);
    });

    it('should return null for invalid icon name', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<Icon name={'nonexistent' as IconName} />);
        expect(consoleWarnSpy).toHaveBeenCalledWith('Icon "nonexistent" not found');
        consoleWarnSpy.mockRestore();
    });

    it('should render with custom stroke width', () => {
        render(<Icon name="check" strokeWidth={3} />);
        const svg = document.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    describe('toIconName', () => {
        it('should return valid icon name unchanged', () => {
            expect(toIconName('filter')).toBe('filter');
            expect(toIconName('search')).toBe('search');
            expect(toIconName('folder')).toBe('folder');
        });

        it('should return default for invalid icon name', () => {
            expect(toIconName('nonexistent')).toBe('default');
            expect(toIconName('')).toBe('default');
            expect(toIconName('random-string')).toBe('default');
        });

        it('should handle all backend layer icons', () => {
            const backendIcons = ['clock', 'tag', 'filter', 'zap', 'search', 'transform', 'alertTriangle', 'split', 'columns'];
            backendIcons.forEach(icon => {
                expect(toIconName(icon)).toBe(icon);
            });
        });
    });
});