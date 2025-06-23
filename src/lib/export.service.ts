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
                const value = row[header as keyof CampaignRecipient];
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

    /**
     * Экспорт успешных получателей в формате для создания новой базы пользователей
     */
    exportSuccessfulRecipientsForUserBase(data: CampaignRecipient[], campaignName: string, filename?: string) {
        // Фильтруем только успешных получателей
        const successfulRecipients = data.filter(recipient => recipient.status === 'success');
        
        if (successfulRecipients.length === 0) {
            alert('Нет успешных получателей для экспорта');
            return;
        }

        // Извлекаем только userId в формате, подходящем для rawUserIds
        const userIds = successfulRecipients.map(recipient => recipient.userId);
        const userIdsText = userIds.join(', ');

        const finalFilename = filename || `${campaignName.replace(/ /g, '_')}_successful_users.txt`;
        const blob = new Blob([userIdsText], { type: 'text/plain;charset=utf-8;' });
        downloadFile(blob, finalFilename);

        return {
            count: successfulRecipients.length,
            userIds: userIds
        };
    },
}; 