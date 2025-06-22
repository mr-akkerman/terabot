import { CampaignRunner } from '@/lib/campaign-runner';
import type { Campaign, CampaignProgress, UserBase, Bot } from '@/types';
import { campaignStore, userBaseStore, botStore } from '@/lib/db';

class CampaignManager {
  private runners = new Map<string, CampaignRunner>();

  private async getOrCreateRunner(campaignId: string): Promise<CampaignRunner> {
    if (this.runners.has(campaignId)) {
        return this.runners.get(campaignId)!;
    }

    console.log(`[Manager] Initializing runner for campaign ${campaignId}`);

    const campaign = await campaignStore.get(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    
    const userBase = await userBaseStore.get(campaign.userBaseId);
    if (!userBase) throw new Error('User base not found for campaign');

    const bot = await botStore.get(campaign.botId);
    if (!bot) throw new Error('Bot not found for campaign');
    
    const onProgress = (progress: CampaignProgress) => {
      // We only update the progress part of the campaign in the DB
      // The status is handled by the control methods (run, pause, etc.)
      campaignStore.get(campaignId).then(c => {
        if (c) campaignStore.update({ ...c, progress });
      });
    };

    const onFinish = (status: Campaign['status'], finalProgress: CampaignProgress) => {
        campaignStore.get(campaignId).then(c => {
            if (c) campaignStore.update({ ...c, progress: finalProgress, status });
        });
        this.runners.delete(campaignId);
        console.log(`[Manager] Finished campaign ${campaignId} with status: ${status}`);
    };

    const onError = (error: Error, finalProgress: CampaignProgress) => {
        campaignStore.get(campaignId).then(c => {
            if (c) campaignStore.update({ ...c, progress: finalProgress, status: 'failed' });
        });
        this.runners.delete(campaignId);
        console.error(`[Manager] Error in campaign ${campaignId}:`, error);
    };

    const runner = new CampaignRunner({ campaign, userBase, bot, onProgress, onFinish, onError });
    this.runners.set(campaignId, runner);
    return runner;
  }

  async run(campaignId: string) {
    const runner = await this.getOrCreateRunner(campaignId);
    const campaign = await campaignStore.get(campaignId);
    if (campaign) {
        await campaignStore.update({ ...campaign, status: runner.getStatus() === 'paused' ? 'running' : 'running' });
    }
    runner.start(); // resumes or starts
  }
  
  async restart(campaignId: string) {
    const runner = await this.getOrCreateRunner(campaignId);
    const campaign = await campaignStore.get(campaignId);
    if (campaign) {
        // Explicitly reset the progress in the database
        const newProgress: CampaignProgress = {
            campaignId: campaign.id,
            totalUsers: 0,
            sentCount: 0,
            failedCount: 0,
            results: [],
        };
        await campaignStore.update({ ...campaign, status: 'running', progress: newProgress });
    }
    runner.restart();
  }

  async pause(campaignId: string) {
    if (!this.runners.has(campaignId)) return;
    const runner = await this.getOrCreateRunner(campaignId);
    runner.pause();
    const campaign = await campaignStore.get(campaignId);
    if (campaign) {
        await campaignStore.update({ ...campaign, status: 'paused' });
    }
  }

  async stop(campaignId: string) {
    if (!this.runners.has(campaignId)) return;
    const runner = await this.getOrCreateRunner(campaignId);
    runner.stop();
    const campaign = await campaignStore.get(campaignId);
    if (campaign) {
        await campaignStore.update({ ...campaign, status: 'stopped' });
    }
  }

  getStatus(campaignId: string): CampaignRunner['status'] | null {
    return this.runners.get(campaignId)?.getStatus() || null;
  }
}

export const CampaignService = new CampaignManager(); 