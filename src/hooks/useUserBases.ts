'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userBaseStore } from '@/lib/db';
import type { UserBase } from '@/types';
import { toast } from 'react-hot-toast';
import { testApiSource } from '@/utils/api';
import { ExportService } from '@/lib/export.service';

const USER_BASES_QUERY_KEY = 'userBases';

export function useUserBases() {
  const queryClient = useQueryClient();

  // Запрос на получение всех баз
  const { data, isLoading, error } = useQuery({
    queryKey: [USER_BASES_QUERY_KEY],
    queryFn: () => userBaseStore.getAll(),
  });

  // Мутация для добавления новой базы
  const { mutate: addUserBase } = useMutation({
    mutationFn: (newUserBase: Omit<UserBase, 'id' | 'createdAt'>) => {
      const fullUserBase: UserBase = {
        ...newUserBase,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      } as UserBase;
      return userBaseStore.add(fullUserBase);
    },
    onSuccess: () => {
      // При успехе - инвалидируем кеш, чтобы useQuery сделал повторный запрос
      queryClient.invalidateQueries({ queryKey: [USER_BASES_QUERY_KEY] });
    },
  });

  // Мутация для обновления
  const { mutate: updateUserBase } = useMutation({
    mutationFn: (userBase: UserBase) => userBaseStore.update(userBase),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_BASES_QUERY_KEY] });
    },
  });

  // Мутация для удаления
  const { mutate: deleteUserBase } = useMutation({
    mutationFn: (id: string) => userBaseStore.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_BASES_QUERY_KEY] });
    },
  });

  const { mutate: checkUserBase, isPending: isChecking } = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const userBase = await userBaseStore.get(id);
      if (!userBase || userBase.type !== 'api' || !userBase.apiUrl) {
        throw new Error('User base is not API-based or has no URL.');
      }
      
      const result = await testApiSource({
        apiUrl: userBase.apiUrl,
        apiMethod: userBase.apiMethod,
        apiHeaders: userBase.apiHeaders,
      });

      const updatedBase: UserBase = { 
        ...userBase,
        userIds: result.success ? result.data : [],
        userCount: result.success ? result.userCount : 0,
        lastCheckStatus: result.success ? 'success' : 'failed',
        lastCheckedAt: new Date(),
        lastError: result.success ? undefined : result.error,
      };

      await userBaseStore.update(updatedBase);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [USER_BASES_QUERY_KEY] });
        toast.success("User base checked successfully!");
    },
    onError: (error) => {
        toast.error(`Failed to check user base: ${error.message}`);
    }
  });

  // Функция экспорта пользователей базы
  const exportUserBase = (userBase: UserBase) => {
    try {
      if (!userBase.userIds || userBase.userIds.length === 0) {
        toast.error('База пользователей пуста или не загружена');
        return;
      }

      const result = ExportService.exportUserBaseAsCommaList(
        userBase.userIds,
        userBase.name
      );

      if (result) {
        toast.success(`Экспортировано ${result.count} пользователей в файл ${result.filename}`);
      }
    } catch (error) {
      console.error('Error exporting user base:', error);
      toast.error('Ошибка при экспорте базы пользователей');
    }
  };

  return {
    userBases: data,
    isLoading,
    error,
    addUserBase,
    updateUserBase,
    deleteUserBase,
    checkUserBase,
    isChecking,
    exportUserBase,
  };
} 