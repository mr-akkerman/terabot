'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botStore } from '@/lib/db';
import type { Bot } from '@/types';

const BOTS_QUERY_KEY = 'bots';

export function useBots() {
  const queryClient = useQueryClient();

  const { data: bots, isLoading, error } = useQuery({
    queryKey: [BOTS_QUERY_KEY],
    queryFn: () => botStore.getAll(),
  });

  const { mutate: addBot } = useMutation({
    mutationFn: (newBot: Omit<Bot, 'id'>) => botStore.add({ id: crypto.randomUUID(), ...newBot }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOTS_QUERY_KEY] });
    },
  });

  const { mutate: updateBot } = useMutation({
    mutationFn: (bot: Bot) => botStore.update(bot),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOTS_QUERY_KEY] });
    },
  });

  const { mutate: deleteBot } = useMutation({
    mutationFn: (id: string) => botStore.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOTS_QUERY_KEY] });
    },
  });

  return {
    bots,
    isLoading,
    error,
    addBot,
    updateBot,
    deleteBot,
  };
} 