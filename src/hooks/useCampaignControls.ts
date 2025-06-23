import { CampaignService } from '@/services/campaign.service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export const useCampaignControls = () => {
    const queryClient = useQueryClient();

    const runMutation = useMutation({
        mutationFn: (campaignId: string) => CampaignService.run(campaignId),
        onSuccess: (data, campaignId) => {
            toast.success('Campaign started/resumed successfully!');
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
            queryClient.invalidateQueries({ queryKey: ['campaignRecipients', campaignId] });
        },
        onError: (error: Error) => {
            toast.error(`Error: ${error.message}`);
        },
    });

    const pauseMutation = useMutation({
        mutationFn: (campaignId: string) => CampaignService.pause(campaignId),
        onSuccess: (data, campaignId) => {
            toast.success('Campaign paused.');
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
            queryClient.invalidateQueries({ queryKey: ['campaignRecipients', campaignId] });
        },
        onError: (error: Error) => {
            toast.error(`Error: ${error.message}`);
        },
    });

    const stopMutation = useMutation({
        mutationFn: (campaignId: string) => CampaignService.stop(campaignId),
        onSuccess: (data, campaignId) => {
            toast.success('Campaign stopped.');
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
            queryClient.invalidateQueries({ queryKey: ['campaignRecipients', campaignId] });
        },
        onError: (error: Error) => {
            toast.error(`Error: ${error.message}`);
        },
    });

    const restartMutation = useMutation({
        mutationFn: (campaignId: string) => CampaignService.restart(campaignId),
        onSuccess: (data, campaignId) => {
            toast.success('Campaign is restarting...');
            // For restart, clear the logs immediately
            queryClient.setQueryData(['campaignRecipients', campaignId], []);
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
            queryClient.invalidateQueries({ queryKey: ['campaignRecipients', campaignId] });
        },
        onError: (error: Error) => {
            toast.error(`Error: ${error.message}`);
        },
    });

    return {
        run: runMutation.mutate,
        pause: pauseMutation.mutate,
        stop: stopMutation.mutate,
        restart: restartMutation.mutate,
        isLoading: runMutation.isPending || pauseMutation.isPending || stopMutation.isPending || restartMutation.isPending,
    };
}; 