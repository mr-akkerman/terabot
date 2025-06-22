'use client';

import { useParams } from 'next/navigation';
import { useCampaignDetails } from '@/hooks/useCampaignDetails';
import { MainLayout } from '@/components/layout/MainLayout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { CampaignStats } from '@/components/campaigns/details/CampaignStats';
import { RecipientLogs } from '@/components/campaigns/details/RecipientLogs';
import { RealtimeChart } from '@/components/campaigns/details/RealtimeChart';
import { RecipientTable } from '@/components/campaigns/details/RecipientTable';
import { useCampaignControls } from '@/hooks/useCampaignControls';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, RefreshCw } from 'lucide-react';


export default function CampaignDetailPage() {
    const params = useParams();
    const campaignId = params.id as string;
    
    const { campaign, recipients, isLoading } = useCampaignDetails(campaignId);
    const { run, pause, stop, restart, isLoading: isControlLoading } = useCampaignControls();

    if (isLoading) return <LoadingSpinner />;
    if (!campaign) return <ErrorMessage message="Campaign not found." />;

    const controlsDisabled = isControlLoading || ['completed', 'loading-users'].includes(campaign.status);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">{campaign.name}</h1>
                    <p className="text-muted-foreground">{campaign.description}</p>
                </div>
                <div className="flex gap-2">
                    {(campaign.status === 'draft' || campaign.status === 'paused' || campaign.status === 'stopped') && (
                        <Button onClick={() => run(campaignId)} disabled={controlsDisabled}>
                            <Play className="mr-2 h-4 w-4" />
                            {campaign.status === 'paused' ? 'Resume' : 'Start'}
                        </Button>
                    )}
                    {campaign.status === 'running' && (
                        <Button onClick={() => pause(campaignId)} disabled={controlsDisabled} variant="outline">
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                        </Button>
                    )}
                     {(campaign.status === 'running' || campaign.status === 'paused') && (
                        <Button onClick={() => stop(campaignId)} disabled={controlsDisabled} variant="destructive">
                            <Square className="mr-2 h-4 w-4" />
                            Stop
                        </Button>
                    )}
                    <Button onClick={() => restart(campaignId)} disabled={isControlLoading} variant="secondary">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Restart
                    </Button>
                </div>
            </div>

            <CampaignStats campaign={campaign} />

            <RealtimeChart recipients={recipients} />

            <RecipientTable recipients={recipients} />

            <RecipientLogs recipients={recipients} />
        </div>
    );
} 