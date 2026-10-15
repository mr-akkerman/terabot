import type { CampaignRunnerStatus, RecoveryResult } from './campaign-engine';

export type CampaignCommand = 'run' | 'pause' | 'stop' | 'restart' | 'getStatus' | 'recover';

/** Результат команды: статус runner'а для getStatus, итог подхвата для recover. */
export type CampaignCommandResult = CampaignRunnerStatus | RecoveryResult | null | undefined;

/** Сообщение из главного потока в воркер. */
export interface CampaignWorkerRequest {
  requestId: number;
  command: CampaignCommand;
  /** Для recover не используется */
  campaignId: string;
}

/** Сообщение из воркера в главный поток. */
export type CampaignWorkerMessage =
  | { type: 'ready' }
  | { type: 'response'; requestId: number; ok: true; result?: CampaignCommandResult }
  | { type: 'response'; requestId: number; ok: false; error: string }
  | { type: 'active'; campaignIds: string[] };
