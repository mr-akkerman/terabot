import type { CampaignEngine, CampaignRunnerStatus } from '@/lib/campaign-engine';
import type {
  CampaignCommand,
  CampaignWorkerMessage,
  CampaignWorkerRequest,
} from '@/lib/campaign-worker-protocol';

interface PendingRequest {
  command: CampaignCommand;
  campaignId: string;
  resolve: (value: CampaignRunnerStatus | null | undefined) => void;
  reject: (reason: Error) => void;
}

/**
 * Фасад над движком рассылок.
 *
 * Основной режим: движок работает в dedicated Web Worker, поэтому рассылка
 * не тормозит, когда вкладка в фоне или окно свёрнуто.
 * Fallback: если воркер не поднялся, тот же движок работает в главном потоке.
 *
 * Пока идёт хотя бы одна рассылка, вкладка держит Web Lock (Chrome не замораживает
 * такие вкладки в режиме Energy Saver) и предупреждает о закрытии через beforeunload.
 */
class CampaignManager {
  private worker: Worker | null = null;
  private workerReady = false;
  private fallbackEnginePromise: Promise<CampaignEngine> | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextRequestId = 1;

  private activeCampaignIds: string[] = [];
  private releasePageLock: (() => void) | null = null;

  private readonly handleBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    // Нужно для старых браузеров, которые смотрят только на returnValue
    event.returnValue = '';
  };

  private readonly handleActiveChange = (campaignIds: string[]) => {
    const wasActive = this.activeCampaignIds.length > 0;
    this.activeCampaignIds = campaignIds;
    const isActive = campaignIds.length > 0;
    if (isActive === wasActive) return;

    if (isActive) {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      this.acquirePageLock();
    } else {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      this.releasePageLock?.();
      this.releasePageLock = null;
    }
  };

  private acquirePageLock() {
    if (this.releasePageLock || !navigator.locks) return;
    const name = `terabot:active-tab:${Date.now()}-${Math.random()}`;
    navigator.locks
      .request(name, () => new Promise<void>((release) => { this.releasePageLock = release; }))
      .catch((error) => console.warn('[CampaignService] Failed to acquire page lock:', error));
  }

  // Движок грузится лениво: в штатном режиме он нужен только внутри воркера.
  private getFallbackEngine(): Promise<CampaignEngine> {
    if (!this.fallbackEnginePromise) {
      console.warn('[CampaignService] Web Worker unavailable, running campaigns on the main thread.');
      this.fallbackEnginePromise = import('@/lib/campaign-engine').then(({ CampaignEngine }) => {
        return new CampaignEngine({ onActiveChange: this.handleActiveChange });
      });
    }
    return this.fallbackEnginePromise;
  }

  private switchToFallback(reason: unknown) {
    console.error('[CampaignService] Campaign worker failed to start:', reason);
    this.worker?.terminate();
    this.worker = null;
    // Воркер не успел выполнить ни одной команды — переигрываем их в главном потоке.
    const requests = [...this.pending.values()];
    this.pending.clear();
    for (const request of requests) {
      this.executeOnFallback(request.command, request.campaignId).then(request.resolve, request.reject);
    }
  }

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.fallbackEnginePromise || typeof Worker === 'undefined') return null;

    try {
      this.worker = new Worker(new URL('../workers/campaign.worker.ts', import.meta.url), {
        type: 'module',
        name: 'terabot-campaigns',
      });
    } catch (error) {
      this.switchToFallback(error);
      return null;
    }

    this.worker.onmessage = (event: MessageEvent<CampaignWorkerMessage>) => {
      const message = event.data;
      switch (message.type) {
        case 'ready':
          this.workerReady = true;
          break;
        case 'active':
          this.handleActiveChange(message.campaignIds);
          break;
        case 'response': {
          const request = this.pending.get(message.requestId);
          if (!request) return;
          this.pending.delete(message.requestId);
          if (message.ok) request.resolve(message.result);
          else request.reject(new Error(message.error));
          break;
        }
      }
    };

    this.worker.onerror = (event) => {
      if (!this.workerReady) {
        event.preventDefault();
        this.switchToFallback(event.message || event);
      } else {
        console.error('[CampaignService] Uncaught error in campaign worker:', event.message);
      }
    };

    return this.worker;
  }

  private async executeOnFallback(
    command: CampaignCommand,
    campaignId: string,
  ): Promise<CampaignRunnerStatus | null | undefined> {
    const engine = await this.getFallbackEngine();
    switch (command) {
      case 'run': await engine.run(campaignId); return;
      case 'pause': await engine.pause(campaignId); return;
      case 'stop': await engine.stop(campaignId); return;
      case 'restart': await engine.restart(campaignId); return;
      case 'getStatus': return engine.getStatus(campaignId);
    }
  }

  private execute(command: CampaignCommand, campaignId: string): Promise<CampaignRunnerStatus | null | undefined> {
    const worker = this.getWorker();
    if (!worker) return this.executeOnFallback(command, campaignId);

    return new Promise((resolve, reject) => {
      const requestId = this.nextRequestId++;
      this.pending.set(requestId, { command, campaignId, resolve, reject });
      const request: CampaignWorkerRequest = { requestId, command, campaignId };
      worker.postMessage(request);
    });
  }

  async run(campaignId: string): Promise<void> {
    await this.execute('run', campaignId);
  }

  async restart(campaignId: string): Promise<void> {
    await this.execute('restart', campaignId);
  }

  async pause(campaignId: string): Promise<void> {
    await this.execute('pause', campaignId);
  }

  async stop(campaignId: string): Promise<void> {
    await this.execute('stop', campaignId);
  }

  async getStatus(campaignId: string): Promise<CampaignRunnerStatus | null> {
    return (await this.execute('getStatus', campaignId)) ?? null;
  }

  /** Работает ли движок в фоновом потоке (false — fallback в главном потоке). */
  isRunningInWorker(): boolean {
    return this.getWorker() !== null;
  }
}

export const CampaignService = new CampaignManager();
