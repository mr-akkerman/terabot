import { CampaignService } from '@/services/campaign.service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export const useCampaignControls = () => {
    const queryClient = useQueryClient();

    const getControlMutation = (
        action: 'run' | 'pause' | 'stop' | 'restart',
        successMessage: string
    ) => {
        return useMutation({
            mutationFn: (campaignId: string) => CampaignService[action](campaignId),
            onSuccess: (data, campaignId) => {
                toast.success(successMessage);

                // For restart, we want to give immediate UI feedback that the logs are cleared
                // before the new pending ones are fetched.
                if (action === 'restart') {
                    queryClient.setQueryData(['campaignRecipients', campaignId], []);
                }

                // Invalidate queries to refetch campaign data and update the UI
                queryClient.invalidateQueries({ queryKey: ['campaigns'] }); // For the list page
                queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] }); // For the detail page campaign data
                queryClient.invalidateQueries({ queryKey: ['campaignRecipients', campaignId] }); // For the detail page recipient logs
            },
            onError: (error: Error) => {
                toast.error(`Error: ${error.message}`);
            },
        });
    };

    const runMutation = getControlMutation('run', 'Campaign started/resumed successfully!');
    const pauseMutation = getControlMutation('pause', 'Campaign paused.');
    const stopMutation = getControlMutation('stop', 'Campaign stopped.');
    const restartMutation = getControlMutation('restart', 'Campaign is restarting...');

    return {
        run: runMutation.mutate,
        pause: pauseMutation.mutate,
        stop: stopMutation.mutate,
        restart: restartMutation.mutate,
        isLoading: runMutation.isPending || pauseMutation.isPending || stopMutation.isPending || restartMutation.isPending,
    };
}; 