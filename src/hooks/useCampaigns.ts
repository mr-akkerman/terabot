'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignStore } from '@/lib/db';
import { Campaign } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { useCampaignControls } from './useCampaignControls';

export const CAMPAIGNS_QUERY_KEY = 'campaigns';

export const useCampaigns = () => {
    const queryClient = useQueryClient();
    const controls = useCampaignControls();

    const { data: campaigns, isLoading } = useQuery<Campaign[]>({
        queryKey: [CAMPAIGNS_QUERY_KEY],
        queryFn: async () => {
            const data = await campaignStore.getAll();
            return data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        },
        refetchInterval: (query) => {
            const data = query.state.data;
            const isAnyCampaignActive = data?.some(c => c.status === 'running' || c.status === 'loading-users');
            return isAnyCampaignActive ? 2000 : false; // Poll every 2 seconds if a campaign is active
        },
    });

    const useGetCampaignQuery = (id: string) => {
        return useQuery<Campaign | undefined>({
            queryKey: [CAMPAIGNS_QUERY_KEY, id],
            queryFn: () => campaignStore.get(id),
            enabled: !!id,
            refetchInterval: (query) => {
                const campaign = query.state.data;
                const isActive = campaign?.status === 'running' || campaign?.status === 'loading-users';
                return isActive ? 2000 : false;
            }
        });
    };

    const addCampaignMutation = useMutation({
        mutationFn: async (campaign: Omit<Campaign, 'id' | 'createdAt' | 'status'>) => {
            const newCampaign: Campaign = {
                ...campaign,
                id: uuidv4(),
                createdAt: new Date(),
                status: 'draft',
            };
            await campaignStore.add(newCampaign);
            return newCampaign;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
        },
    });

    const updateCampaignMutation = useMutation({
        mutationFn: (campaign: Campaign) => campaignStore.update(campaign),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY, variables.id] });
        },
    });

    const deleteCampaignMutation = useMutation({
        mutationFn: (id: string) => campaignStore.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
        },
    });

    return {
        campaigns,
        isLoading,
        getCampaignQuery: useGetCampaignQuery,
        addCampaign: addCampaignMutation.mutateAsync,
        updateCampaign: updateCampaignMutation.mutateAsync,
        deleteCampaign: deleteCampaignMutation.mutateAsync,
        isAdding: addCampaignMutation.isPending,
        isUpdating: updateCampaignMutation.isPending,
        startCampaign: controls.run,
        pauseCampaign: controls.pause,
        stopCampaign: controls.stop,
        restartCampaign: controls.restart,
    };
}; 