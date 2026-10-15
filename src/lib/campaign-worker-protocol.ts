import type { CampaignRunnerStatus } from './campaign-engine';

export type CampaignCommand = 'run' | 'pause' | 'stop' | 'restart' | 'getStatus';

/** Сообщение из главного потока в воркер. */
export interface CampaignWorkerRequest {
  requestId: number;
  command: CampaignCommand;
  campaignId: string;
}

/** Сообщение из воркера в главный поток. */
export type CampaignWorkerMessage =
  | { type: 'ready' }
  | { type: 'response'; requestId: number; ok: true; result?: CampaignRunnerStatus | null }
  | { type: 'response'; requestId: number; ok: false; error: string }
  | { type: 'active'; campaignIds: string[] };
