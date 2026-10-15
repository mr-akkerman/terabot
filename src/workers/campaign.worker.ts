/// <reference lib="webworker" />
// Рассылка крутится в dedicated worker: таймеры здесь не попадают под
// intensive throttling, который браузер включает для скрытых вкладок.
import { CampaignEngine } from '@/lib/campaign-engine';
import type { CampaignWorkerMessage, CampaignWorkerRequest } from '@/lib/campaign-worker-protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (message: CampaignWorkerMessage) => ctx.postMessage(message);

const engine = new CampaignEngine({
  onActiveChange: (campaignIds) => post({ type: 'active', campaignIds }),
});

ctx.onmessage = async (event: MessageEvent<CampaignWorkerRequest>) => {
  const { requestId, command, campaignId } = event.data;
  try {
    let result;
    switch (command) {
      case 'run': await engine.run(campaignId); break;
      case 'pause': await engine.pause(campaignId); break;
      case 'stop': await engine.stop(campaignId); break;
      case 'restart': await engine.restart(campaignId); break;
      case 'getStatus': result = engine.getStatus(campaignId); break;
    }
    post({ type: 'response', requestId, ok: true, result });
  } catch (error) {
    post({ type: 'response', requestId, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};

post({ type: 'ready' });
