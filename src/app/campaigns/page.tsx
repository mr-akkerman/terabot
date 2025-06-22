'use client';

import { useRouter } from 'next/navigation';
import { PlusCircle } from 'lucide-react';
import { useMemo, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { getCampaignsColumns, CampaignsAction } from '@/components/campaigns/columns';
import { useCampaigns } from '@/hooks';
import type { Campaign } from '@/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export default function CampaignsPage() {
  const router = useRouter();
  const { campaigns, isLoading, error, deleteCampaign, runCampaign, pauseCampaign, stopCampaign } = useCampaigns();

  const handleAction = useCallback((action: CampaignsAction) => {
    switch (action.type) {
      case 'run':
        runCampaign(action.id);
        break;
      case 'pause':
        pauseCampaign(action.id);
        break;
      case 'stop':
        stopCampaign(action.id);
        break;
      case 'edit':
        router.push(`/campaigns/create?campaignId=${action.id}`);
        break;
      case 'delete':
        const campaignToDelete = campaigns?.find((c: Campaign) => c.id === action.id);
        if (campaignToDelete) {
          if (confirm(`Are you sure you want to delete campaign "${campaignToDelete.name}"?`)) {
              deleteCampaign(action.id);
          }
        }
        break;
    }
  }, [campaigns, deleteCampaign, pauseCampaign, runCampaign, stopCampaign, router]);
  
  const columns = useMemo(() => getCampaignsColumns({ onAction: handleAction }), [handleAction]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error.message} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Button onClick={() => router.push('/campaigns/create')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>
      <DataTable columns={columns} data={campaigns || []} />
    </div>
  );
} 