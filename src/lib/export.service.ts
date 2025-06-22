import type { CampaignRecipient } from '@/types';

function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export const ExportService = {
    exportToJson(data: CampaignRecipient[], filename = 'report.json') {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        downloadFile(blob, filename);
    },

    exportToCsv(data: CampaignRecipient[], filename = 'report.csv') {
        if (data.length === 0) return;

        const headers = ['userId', 'status', 'error', 'timestamp'];
        const csvRows = [headers.join(',')];

        for (const row of data) {
            const values = headers.map(header => {
                const value = (row as any)[header];
                if (value === null || value === undefined) return '';
                // Escape commas and quotes
                let stringValue = String(value);
                if (stringValue.includes('"') || stringValue.includes(',')) {
                    stringValue = `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, filename);
    },
}; 