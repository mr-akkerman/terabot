'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useBots } from '@/hooks';
import type { Bot } from '@/types';
import { TelegramAPI } from '@/utils/telegram';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const botFormSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }),
  token: z.string().min(10, { message: 'A valid Telegram Bot Token is required.' }),
});

type BotFormValues = z.infer<typeof botFormSchema>;

interface BotDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  bot?: Bot;
}

export function BotDialog({ isOpen, setIsOpen, bot }: BotDialogProps) {
  const { addBot, updateBot } = useBots();
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const form = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: { name: '', token: '' },
  });

  useEffect(() => {
    if (bot) {
      form.reset(bot);
    } else {
      form.reset({ name: '', token: '' });
    }
  }, [bot, form]);

  const handleTestAndSubmit = async (data: BotFormValues) => {
    setIsTesting(true);
    setTestError(null);
    try {
      const api = new TelegramAPI(data.token);
      await api.getMe();
      
      const payload = {
        ...data,
        lastCheckStatus: 'success' as const,
        lastCheckedAt: new Date(),
        lastError: undefined,
      }
      
      if (bot) {
        updateBot({ ...bot, ...payload });
      } else {
        addBot(payload);
      }
      setIsOpen(false);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      setTestError(message);
      if (bot) {
        updateBot({ 
          ...bot, 
          lastCheckStatus: 'failed' as const, 
          lastCheckedAt: new Date(),
          lastError: message
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bot ? 'Edit' : 'Add New'} Bot</DialogTitle>
          <DialogDescription>
            Provide a name and the token for your bot. The token will be tested before saving.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleTestAndSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. My Marketing Bot" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Token</FormLabel>
                  <FormControl>
                    <Input placeholder="123456:ABC-DEF..." type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {testError && <p className="text-sm text-destructive">{testError}</p>}
            <Button type="submit" disabled={isTesting}>
              {isTesting && <LoadingSpinner className="mr-2 h-4 w-4" />}
              {bot ? 'Save Changes' : 'Test and Save'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 