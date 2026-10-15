'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CampaignService } from '@/services/campaign.service';

/**
 * При загрузке приложения подхватывает кампании, которые остались в статусе
 * running после перезагрузки или закрытия вкладки, и продолжает рассылку
 * с того места, где она остановилась.
 */
export function CampaignRecovery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    CampaignService.recoverInterrupted()
      .then(({ resumed, failed }) => {
        if (cancelled || (resumed.length === 0 && failed.length === 0)) return;
        for (const campaign of resumed) {
          toast.success(`Campaign "${campaign.name}" resumed after page reload`);
        }
        for (const campaign of failed) {
          toast.error(`Campaign "${campaign.name}" could not be resumed and was paused: ${campaign.error}`);
        }
        queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      })
      .catch((error) => console.error('[CampaignRecovery] Recovery failed:', error));
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return null;
}
