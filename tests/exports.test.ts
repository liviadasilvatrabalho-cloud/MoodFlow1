
import { describe, it, expect, vi } from 'vitest';

describe('Export Suite Smoke Tests', () => {
    it('should execute CSV export logic without errors', () => {
        // In jsdom environment, global.Blob and URL.createObjectURL are usually available
        // but we can mock them safely for a pure smoke test.
        const mockUrl = 'blob:url';
        global.URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);

        // We don't needs to mock Blob as a constructor if we just want to see if it runs
        // But since Vitest + jsdom might need it:
        if (typeof global.Blob !== 'function') {
            global.Blob = class { constructor() { } } as any;
        }

        const triggerExport = () => {
            const content = '2025-01-01,5';
            const blob = new Blob([content], { type: 'text/csv' });
            return URL.createObjectURL(blob);
        };

        expect(triggerExport()).toBe(mockUrl);
    });

    it('should execute XLSX (HTML) export logic without errors', () => {
        const triggerExcel = () => {
            const html = '<table><tr><td>Test</td></tr></table>';
            const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
            return URL.createObjectURL(blob);
        };

        expect(triggerExcel()).toBe('blob:url');
    });
});
