import { CampaignRunner } from '@/lib/campaign-runner';
import type { Campaign, CampaignProgress } from '@/types';
import { campaignStore, userBaseStore, botStore } from '@/lib/db';

type CampaignRunParams = {
  campaignId: string;
  onStateChange: (campaign: Campaign) => void;
};

class CampaignServiceController {
  private runners = new Map<string, CampaignRunner>();

  async startCampaign({ campaignId, onStateChange }: CampaignRunParams) {
    if (this.runners.has(campaignId)) {
      console.warn(`Campaign ${campaignId} is already running.`);
      return;
    }
    
    console.log(`[Service] Initializing campaign ${campaignId}`);

    const campaign = await campaignStore.get(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    
    const userBase = await userBaseStore.get(campaign.userBaseId);
    if (!userBase || !userBase.userIds) throw new Error('User base not found or is empty');

    const bot = await botStore.get(campaign.botId);
    if (!bot) throw new Error('Bot not found');
    
    const onProgress = (progress: CampaignProgress) => {
      const updatedCampaign: Campaign = { ...campaign, progress, status: 'running' };
      campaignStore.update(updatedCampaign);
      onStateChange(updatedCampaign);
      console.log(`[Service] Progress for ${campaignId}: ${progress.sentCount}/${progress.totalUsers}`);
    };

    const onFinish = (status: string, finalProgress: CampaignProgress) => {
        const finalStatus = (status === 'stopped' || status === 'paused') ? status : 'completed';
        const updatedCampaign: Campaign = { ...campaign, progress: finalProgress, status: finalStatus as Campaign['status'] };
        campaignStore.update(updatedCampaign);
        onStateChange(updatedCampaign);
        this.runners.delete(campaignId);
        console.log(`[Service] Finished campaign ${campaignId} with status: ${finalStatus}`);
    };

    const onError = (error: Error, finalProgress: CampaignProgress) => {
        const updatedCampaign: Campaign = { ...campaign, progress: finalProgress, status: 'failed' };
        campaignStore.update(updatedCampaign);
        onStateChange(updatedCampaign);
        this.runners.delete(campaignId);
        console.error(`[Service] Error in campaign ${campaignId}:`, error);
    };

    const runner = new CampaignRunner({
      campaign,
      userBase,
      bot,
      onProgress,
      onFinish,
      onError,
    });
    
    this.runners.set(campaignId, runner);
    runner.start();

    const initialUpdate: Campaign = { ...campaign, status: 'running', progress: (runner as any).progress };
    await campaignStore.update(initialUpdate);
    onStateChange(initialUpdate);
  }

  pauseCampaign(campaignId: string) {
    const runner = this.runners.get(campaignId);
    if (runner) {
      runner.pause();
      console.log(`[Service] Paused campaign ${campaignId}`);
    }
  }

  stopCampaign(campaignId: string) {
    const runner = this.runners.get(campaignId);
    if (runner) {
      runner.stop();
       console.log(`[Service] Stopped campaign ${campaignId}`);
    }
  }

  getRunnerStatus(campaignId: string) {
    return this.runners.get(campaignId)?.getStatus() || null;
  }
}

export const CampaignService = new CampaignServiceController(); 