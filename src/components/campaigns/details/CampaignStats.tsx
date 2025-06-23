'use client';

import type { Campaign } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface CampaignStatsProps {
    campaign: Campaign;
}

export const CampaignStats = ({ campaign }: CampaignStatsProps) => {
    const progress = campaign.progress;
    if (!progress) {
        return <Card><CardContent>No progress data available yet.</CardContent></Card>;
    }
    
    const { totalUsers, sentCount, failedCount } = progress;
    const processedCount = sentCount + failedCount;
    const percentage = totalUsers > 0 ? (processedCount / totalUsers) * 100 : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Overall Progress</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-2xl font-bold">{sentCount}</p>
                        <p className="text-sm text-muted-foreground">Successful</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-destructive">{failedCount}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{totalUsers}</p>
                        <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                </div>
                <div className="mt-4">
                    <Progress value={percentage} className="h-4" />
                    <p className="text-center text-sm text-muted-foreground mt-2">
                        {processedCount} of {totalUsers} processed ({percentage.toFixed(1)}%)
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}; 