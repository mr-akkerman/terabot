import { useQuery } from '@tanstack/react-query';
import { campaignRecipientStore } from '@/lib/db';
import { useCampaigns } from './useCampaigns';

export const useCampaignDetails = (campaignId: string) => {
    // Re-use the campaign query logic
    const { getCampaignQuery } = useCampaigns();
    const { data: campaign, isLoading: isCampaignLoading } = getCampaignQuery(campaignId);

    // Fetch all recipients for this campaign
    const { data: recipients, isLoading: isRecipientsLoading } = useQuery({
        queryKey: ['campaignRecipients', campaignId],
        queryFn: () => campaignRecipientStore.getByCampaignId(campaignId),
        enabled: !!campaignId,
        refetchInterval: () => {
            const isCampaignActive = campaign?.status === 'running' || campaign?.status === 'loading-users';
            return isCampaignActive ? 2000 : false;
        },
    });

    return {
        campaign,
        recipients: recipients || [],
        isLoading: isCampaignLoading || isRecipientsLoading,
    };
}; 