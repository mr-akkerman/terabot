'use client';

import type { Campaign } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

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
                {progress.parts && progress.parts.length > 0 && (
                    <div className="mt-6 space-y-2" data-testid="campaign-parts">
                        <p className="text-sm font-medium">
                            Parts: {progress.parts.filter(part => part.status === 'completed').length} of {progress.parts.length} sent
                        </p>
                        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                            {progress.parts.map((part) => {
                                const partPercentage = part.totalUsers > 0 ? (part.processedCount / part.totalUsers) * 100 : 100;
                                return (
                                    <li key={part.userBaseId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
                                        <span className="truncate font-medium">{part.name}</span>
                                        <span className="flex items-center gap-2 text-muted-foreground">
                                            {part.processedCount} / {part.totalUsers}
                                            <Badge variant={part.status === 'running' ? 'default' : 'outline'} className="capitalize">
                                                {part.status === 'completed' ? 'sent' : part.status === 'running' ? 'sending' : 'queued'}
                                            </Badge>
                                        </span>
                                        <Progress value={partPercentage} className="col-span-2 h-1.5" />
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}; 