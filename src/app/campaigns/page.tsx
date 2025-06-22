'use client';

import React, { useMemo, useCallback } from 'react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { getCampaignsColumns } from '@/components/campaigns/columns';
import type { CampaignsAction } from '@/components/campaigns/columns';
import { DataTable } from '@/components/ui/data-table';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function CampaignsPage() {
    const router = useRouter();
    const { 
        campaigns, 
        isLoading, 
        deleteCampaign, 
        startCampaign, 
        pauseCampaign, 
        stopCampaign, 
        restartCampaign 
    } = useCampaigns();

    const handleAction = useCallback((action: CampaignsAction) => {
        switch (action.type) {
            case 'edit':
                router.push(`/campaigns/create?campaignId=${action.id}`);
                break;
            case 'delete':
                if (window.confirm('Are you sure you want to delete this campaign?')) {
                    deleteCampaign(action.id);
                }
                break;
            case 'run':
                startCampaign(action.id);
                break;
            case 'pause':
                pauseCampaign(action.id);
                break;
            case 'stop':
                stopCampaign(action.id);
                break;
            case 'restart':
                restartCampaign(action.id);
                break;
            default:
                break;
        }
    }, [deleteCampaign, pauseCampaign, restartCampaign, router, startCampaign, stopCampaign]);

    const columns = useMemo(() => getCampaignsColumns({ onAction: handleAction }), [handleAction]);

    if (isLoading) {
        return <MainLayout><div>Loading...</div></MainLayout>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Campaigns</h1>
                <Button onClick={() => router.push('/campaigns/create')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Campaign
                </Button>
            </div>
            <DataTable
                columns={columns}
                data={campaigns || []}
                onRowClick={(campaign) => router.push(`/campaigns/${campaign.id}`)}
            />
        </div>
    );
}