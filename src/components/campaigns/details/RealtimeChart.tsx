'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CampaignRecipient } from '@/types';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RealtimeChartProps {
    recipients: CampaignRecipient[];
}

export const RealtimeChart = ({ recipients }: RealtimeChartProps) => {
    const chartData = useMemo(() => {
        if (recipients.length === 0) return [];
        
        const sendsByMinute: { [key: string]: { success: number, failed: number } } = {};

        recipients
            .filter(r => (r.status === 'success' || r.status === 'failed') && r.timestamp)
            .forEach(r => {
                const date = new Date(r.timestamp);
                // Skip any records with an invalid date
                if (isNaN(date.getTime())) return;

                const minute = date.toISOString().slice(0, 16); // Group by minute
                if (!sendsByMinute[minute]) {
                    sendsByMinute[minute] = { success: 0, failed: 0 };
                }
                const status = r.status as 'success' | 'failed';
                sendsByMinute[minute][status]++;
            });

        return Object.entries(sendsByMinute)
            .map(([time, counts]) => ({ time, ...counts }))
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    }, [recipients]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Send Rate</CardTitle>
            </CardHeader>
            <CardContent>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString()} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="success" stroke="#22c55e" name="Successful" />
                            <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p>No sending data yet to display a chart.</p>
                )}
            </CardContent>
        </Card>
    );
}; 