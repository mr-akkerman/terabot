'use client';

import { useParams } from 'next/navigation';
import { useCampaignDetails } from '@/hooks/useCampaignDetails';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { CampaignStats } from '@/components/campaigns/details/CampaignStats';
import { RecipientLogs } from '@/components/campaigns/details/RecipientLogs';
import { RealtimeChart } from '@/components/campaigns/details/RealtimeChart';
import { RecipientTable } from '@/components/campaigns/details/RecipientTable';
import { ExportDialog, ExportSuccessfulUsersDialog } from '@/components/campaigns/details/ExportDialog';
import { useCampaignControls } from '@/hooks/useCampaignControls';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, RefreshCw, Download, Users } from 'lucide-react';
import { useState, useMemo } from 'react';

export default function CampaignDetailPage() {
    const params = useParams();
    const campaignId = params.id as string;
    
    const { campaign, recipients, isLoading } = useCampaignDetails(campaignId);
    const { run, pause, stop, restart, isLoading: isControlLoading } = useCampaignControls();
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isExportSuccessfulDialogOpen, setIsExportSuccessfulDialogOpen] = useState(false);

    // Подсчитываем количество успешных получателей
    const successfulRecipientsCount = useMemo(() => {
        return recipients?.filter(r => r.status === 'success').length || 0;
    }, [recipients]);

    if (isLoading) return <LoadingSpinner />;
    if (!campaign) return <ErrorMessage message="Campaign not found." />;

    const controlsDisabled = isControlLoading || ['completed', 'loading-users'].includes(campaign.status);
    // Показываем кнопки экспорта только если есть данные для экспорта
    const hasRecipientsData = recipients && recipients.length > 0;
    const hasSuccessfulRecipients = successfulRecipientsCount > 0;

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
                    {hasRecipientsData && (
                        <Button onClick={() => setIsExportDialogOpen(true)} variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Export Results
                        </Button>
                    )}
                    {hasSuccessfulRecipients && (
                        <Button onClick={() => setIsExportSuccessfulDialogOpen(true)} variant="outline">
                            <Users className="mr-2 h-4 w-4" />
                            Export Recipients ({successfulRecipientsCount})
                        </Button>
                    )}
                </div>
            </div>

            <CampaignStats campaign={campaign} />

            <RealtimeChart recipients={recipients} />

            <RecipientTable recipients={recipients} />

            <RecipientLogs recipients={recipients} />

            {hasRecipientsData && (
                <ExportDialog
                    isOpen={isExportDialogOpen}
                    setIsOpen={setIsExportDialogOpen}
                    data={recipients}
                    campaignName={campaign.name}
                />
            )}

            {hasSuccessfulRecipients && (
                <ExportSuccessfulUsersDialog
                    isOpen={isExportSuccessfulDialogOpen}
                    setIsOpen={setIsExportSuccessfulDialogOpen}
                    data={recipients}
                    campaignName={campaign.name}
                />
            )}
        </div>
    );
} 