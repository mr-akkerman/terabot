import { CampaignRunner } from '@/lib/campaign-runner';
import type { Campaign, CampaignProgress } from '@/types';
import { campaignStore, userBaseStore, botStore, campaignRecipientStore } from '@/lib/db';

// Не пишем прогресс в IndexedDB на каждое сообщение — UI всё равно опрашивает БД раз в 2 секунды.
const PROGRESS_FLUSH_MS = 500;

export type CampaignRunnerStatus = ReturnType<CampaignRunner['getStatus']>;

/** Кампания уже выполняется в другой вкладке (её Web Lock занят). */
export class CampaignLockedError extends Error {
  constructor() {
    super('Эта кампания уже запущена в другой вкладке');
    this.name = 'CampaignLockedError';
  }
}

export interface RecoveryResult {
  /** Кампании, которые были прерваны перезагрузкой и снова запущены. */
  resumed: { id: string; name: string }[];
  /** Кампании, которые продолжить не удалось: переведены в paused. */
  failed: { id: string; name: string; error: string }[];
}

// Статусы, в которых кампания должна активно рассылаться
const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['running', 'loading-users']);

export interface CampaignEngineEvents {
  /** Вызывается при каждом изменении набора кампаний, которые сейчас реально рассылаются. */
  onActiveChange?: (activeCampaignIds: string[]) => void;
}

/**
 * Управляет runner'ами кампаний. Не зависит от окружения: работает и внутри
 * Web Worker (основной режим), и в главном потоке (fallback).
 */
export class CampaignEngine {
  private runners = new Map<string, CampaignRunner>();
  // Web Lock на каждую активную кампанию: не даёт запустить одну кампанию
  // в двух вкладках одновременно и заодно защищает вкладку от заморозки.
  private lockReleases = new Map<string, () => void>();
  private pendingProgress = new Map<string, CampaignProgress>();
  private flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly events: CampaignEngineEvents = {}) {}

  private emitActiveChange() {
    this.events.onActiveChange?.([...this.lockReleases.keys()]);
  }

  private async acquireCampaignLock(campaignId: string): Promise<void> {
    if (this.lockReleases.has(campaignId)) return;
    if (typeof navigator === 'undefined' || !navigator.locks) {
      this.lockReleases.set(campaignId, () => {});
      this.emitActiveChange();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      navigator.locks
        .request(`terabot:campaign:${campaignId}`, { ifAvailable: true }, (lock) => {
          if (!lock) {
            reject(new CampaignLockedError());
            return;
          }
          // Держим лок, пока не вызовут release.
          return new Promise<void>((release) => {
            this.lockReleases.set(campaignId, release);
            resolve();
          });
        })
        .catch(reject);
    });
    this.emitActiveChange();
  }

  private releaseCampaignLock(campaignId: string) {
    const release = this.lockReleases.get(campaignId);
    if (!release) return;
    this.lockReleases.delete(campaignId);
    release();
    this.emitActiveChange();
  }

  private scheduleProgressFlush(campaignId: string, progress: CampaignProgress) {
    this.pendingProgress.set(campaignId, progress);
    if (this.flushTimers.has(campaignId)) return;
    this.flushTimers.set(
      campaignId,
      setTimeout(() => {
        this.flushTimers.delete(campaignId);
        void this.flushProgress(campaignId);
      }, PROGRESS_FLUSH_MS),
    );
  }

  private async flushProgress(campaignId: string) {
    const timer = this.flushTimers.get(campaignId);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(campaignId);
    }
    const progress = this.pendingProgress.get(campaignId);
    if (!progress) return;
    this.pendingProgress.delete(campaignId);
    await campaignStore.patch(campaignId, { progress: { ...progress } });
  }

  private async getOrCreateRunner(campaignId: string): Promise<CampaignRunner> {
    const existing = this.runners.get(campaignId);
    if (existing) return existing;

    console.log(`[Engine] Initializing runner for campaign ${campaignId}`);

    const campaign = await campaignStore.get(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const userBase = await userBaseStore.get(campaign.userBaseId);
    if (!userBase) throw new Error('User base not found for campaign');

    const bot = await botStore.get(campaign.botId);
    if (!bot) throw new Error('Bot not found for campaign');

    // Колбэки от runner'а, который уже заменили (restart), игнорируем,
    // чтобы они не перетёрли статус новой попытки.
    const isCurrent = () => this.runners.get(campaignId) === runner;

    const finalize = async (status: Campaign['status'], finalProgress: CampaignProgress) => {
      if (!isCurrent()) return;
      this.runners.delete(campaignId);
      this.pendingProgress.delete(campaignId);
      await this.flushProgress(campaignId);
      await campaignStore.patch(campaignId, { progress: { ...finalProgress }, status });
      this.releaseCampaignLock(campaignId);
    };

    const runner: CampaignRunner = new CampaignRunner({
      campaign,
      userBase,
      bot,
      onProgress: (progress) => {
        if (isCurrent()) this.scheduleProgressFlush(campaignId, progress);
      },
      onFinish: (status, finalProgress) => {
        console.log(`[Engine] Finished campaign ${campaignId} with status: ${status}`);
        void finalize(status, finalProgress);
      },
      onError: (error, finalProgress) => {
        console.error(`[Engine] Error in campaign ${campaignId}:`, error);
        void finalize('failed', finalProgress);
      },
    });
    this.runners.set(campaignId, runner);
    return runner;
  }

  async run(campaignId: string) {
    console.log(`[Engine] Starting/resuming campaign ${campaignId}`);
    await this.acquireCampaignLock(campaignId);
    try {
      const runner = await this.getOrCreateRunner(campaignId);
      await campaignStore.patch(campaignId, { status: 'running' });
      void runner.start(); // resumes or starts
    } catch (error) {
      this.releaseCampaignLock(campaignId);
      throw error;
    }
  }

  async restart(campaignId: string) {
    console.log(`[Engine] Restarting campaign ${campaignId}`);
    await this.acquireCampaignLock(campaignId);
    try {
      const oldRunner = this.runners.get(campaignId);
      if (oldRunner) {
        this.runners.delete(campaignId); // до stop(), чтобы его onFinish проигнорировался
        oldRunner.stop();
      }
      this.pendingProgress.delete(campaignId);

      // Clear previous recipient logs for this campaign
      await campaignRecipientStore.clearForCampaign(campaignId);

      // Explicitly reset the progress in the database
      const newProgress: CampaignProgress = {
        campaignId,
        totalUsers: 0,
        sentCount: 0,
        failedCount: 0,
        results: [],
      };
      await campaignStore.patch(campaignId, { status: 'running', progress: newProgress });

      const runner = await this.getOrCreateRunner(campaignId);
      void runner.restart();
    } catch (error) {
      this.releaseCampaignLock(campaignId);
      throw error;
    }
  }

  async pause(campaignId: string) {
    console.log(`[Engine] Pausing campaign ${campaignId}`);
    const runner = this.runners.get(campaignId);
    if (runner) {
      runner.pause();
      await this.flushProgress(campaignId);
    } else {
      console.log(`[Engine] No active runner for campaign ${campaignId}, just updating status`);
    }
    await campaignStore.patch(campaignId, { status: 'paused' });
    this.releaseCampaignLock(campaignId);
  }

  async stop(campaignId: string) {
    console.log(`[Engine] Stopping campaign ${campaignId}`);
    const runner = this.runners.get(campaignId);
    if (runner) {
      // stop() синхронно вызывает onFinish → finalize сохранит прогресс и отпустит лок
      runner.stop();
    } else {
      console.log(`[Engine] No active runner for campaign ${campaignId}, just updating status`);
    }
    await campaignStore.patch(campaignId, { status: 'stopped' });
    this.releaseCampaignLock(campaignId);
  }

  /**
   * Подхватывает кампании, которые остались в статусе running после перезагрузки
   * или закрытия вкладки: в БД они «идут», но никто их не рассылает.
   * Кампании, которые сейчас крутит другая вкладка, пропускаются (их лок занят).
   */
  async recoverInterrupted(): Promise<RecoveryResult> {
    const result: RecoveryResult = { resumed: [], failed: [] };
    const campaigns = await campaignStore.getAll();

    for (const campaign of campaigns) {
      if (!ACTIVE_STATUSES.has(campaign.status) || this.runners.has(campaign.id)) continue;
      try {
        await this.run(campaign.id);
        result.resumed.push({ id: campaign.id, name: campaign.name });
        console.log(`[Engine] Recovered interrupted campaign ${campaign.id}`);
      } catch (error) {
        if (error instanceof CampaignLockedError) continue;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Engine] Failed to recover campaign ${campaign.id}:`, error);
        await campaignStore.patch(campaign.id, { status: 'paused' });
        result.failed.push({ id: campaign.id, name: campaign.name, error: message });
      }
    }
    return result;
  }

  getStatus(campaignId: string): CampaignRunnerStatus | null {
    return this.runners.get(campaignId)?.getStatus() || null;
  }
}
