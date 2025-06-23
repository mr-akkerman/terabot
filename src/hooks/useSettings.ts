'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsStore } from '@/lib/db';

const SETTINGS_QUERY_KEY = 'settings';
const BOT_TOKEN_KEY = 'botToken';

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: botToken, isLoading: isLoadingToken } = useQuery({
    queryKey: [SETTINGS_QUERY_KEY, BOT_TOKEN_KEY],
    queryFn: () => settingsStore.get(BOT_TOKEN_KEY),
  });

  const { mutateAsync: setBotToken, isPending: isSavingToken } = useMutation({
    mutationFn: (token: string) => settingsStore.set(BOT_TOKEN_KEY, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY, BOT_TOKEN_KEY] });
    },
  });

  return {
    botToken,
    isLoadingToken,
    setBotToken,
    isSavingToken,
  };
} 