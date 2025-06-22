'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignStore } from '@/lib/db';
import type { Campaign } from '@/types';
import { CampaignService } from '@/services/campaign.service';

const CAMPAIGNS_QUERY_KEY = 'campaigns';

export function useCampaigns() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: [CAMPAIGNS_QUERY_KEY],
    queryFn: () => campaignStore.getAll(),
  });

  const { mutate: addCampaign, isPending: isAdding } = useMutation<
    string,
    Error,
    Pick<Campaign, 'name' | 'description' | 'botId' | 'userBaseId' | 'sendSettings' | 'message'>
    >({
    mutationFn: (newCampaign) => {
      const fullCampaign: Campaign = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        status: 'draft',
        ...newCampaign,
      };
      return campaignStore.add(fullCampaign);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
    },
  });

  const { mutate: updateCampaign, isPending: isUpdating } = useMutation({
    mutationFn: (campaign: Campaign) => campaignStore.update(campaign),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
    },
  });

  const { mutate: deleteCampaign } = useMutation({
    mutationFn: (id: string) => campaignStore.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
    },
  });

  const runCampaign = (campaignId: string) => {
    CampaignService.startCampaign({
      campaignId,
      onStateChange: () => {
        queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
      },
    }).catch(error => {
        console.error("Failed to start campaign:", error);
        queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
    });
  };

  const pauseCampaign = (campaignId: string) => {
    CampaignService.pauseCampaign(campaignId);
  };

  const stopCampaign = (campaignId: string) => {
    CampaignService.stopCampaign(campaignId);
  };


  return {
    campaigns: data,
    isLoading,
    error,
    addCampaign,
    isAdding,
    updateCampaign,
    isUpdating,
    deleteCampaign,
    runCampaign,
    pauseCampaign,
    stopCampaign,
  };
} 