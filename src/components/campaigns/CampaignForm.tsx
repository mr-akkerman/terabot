'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserBases, useCampaigns, useBots } from '@/hooks';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { Campaign } from '@/types';
import { MarkdownEditor } from '../ui/MarkdownEditor';
import { TelegramPreview } from './TelegramPreview';
import { validateTelegramHtml } from '@/lib/telegram-html';
import { ButtonEditor } from './ButtonEditor';
import { ImageUploader } from './ImageUploader';

const buttonSchema = z.object({
    id: z.string(),
    text: z.string().min(1, "Text is required").max(64, "Text too long"),
    type: z.enum(['url', 'callback']),
    url: z.string().optional(),
    callback_data: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'url') {
        const result = z.string().url().safeParse(data.url);
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['url'],
                message: 'A valid URL is required.',
            });
        }
    } else if (data.type === 'callback') {
        const result = z.string().min(1).max(64).safeParse(data.callback_data);
        if (!result.success) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['callback_data'],
                message: 'Callback data must be 1-64 bytes.',
            });
        }
    }
});

export const campaignFormSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters long.' }),
  description: z.string().optional(),
  botId: z.string({ required_error: 'Please select a bot.' }),
  userBaseId: z.string({ required_error: 'Please select a user base.' }),
  sendSettings: z.object({
    intervalMs: z.coerce.number().min(100).max(5000),
    chunkSize: z.coerce.number().min(1).max(25),
  }),
  message: z.object({
      text: z.string()
        .min(1, { message: 'Message cannot be empty.'})
        .max(4096, { message: 'Message cannot be longer than 4096 characters.'})
        .refine(validateTelegramHtml, (issue) => ({ message: issue as string })),
      buttons: z.array(z.array(buttonSchema)).optional(),
      photo: z.string().optional(),
  })
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export function CampaignForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId');

  const { campaigns, isLoading: isLoadingCampaigns, updateCampaign, addCampaign, isAdding, isUpdating } = useCampaigns();
  const { userBases, isLoading: isLoadingBases } = useUserBases();
  const { bots, isLoading: isLoadingBots } = useBots();
  
  const existingCampaign = useMemo(() => {
    return campaignId && campaigns ? campaigns.find(c => c.id === campaignId) : undefined;
  }, [campaignId, campaigns]);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: existingCampaign ? {
        ...existingCampaign,
        message: {
            ...existingCampaign.message,
            buttons: existingCampaign.message.buttons || [],
        }
    } : {
      name: '',
      description: '',
      sendSettings: {
        intervalMs: 500,
        chunkSize: 10,
      },
      message: {
        text: '',
        buttons: [],
        photo: undefined,
      }
    },
  });
  
  useEffect(() => {
    if (existingCampaign) {
      form.reset(existingCampaign);
    }
  }, [existingCampaign, form]);

  const selectedBaseId = form.watch('userBaseId');
  
  const selectedUserBase = useMemo(() => {
    return userBases?.find(base => base.id === selectedBaseId);
  }, [userBases, selectedBaseId]);

  const onSubmit = (data: CampaignFormValues) => {
    const campaignData = {
        ...data,
        message: {
            ...data.message,
            id: existingCampaign?.message.id || crypto.randomUUID(),
            parse_mode: 'HTML' as const,
        },
    };

    const handleSuccess = () => {
        toast.success(`Campaign ${existingCampaign ? 'updated' : 'created'} successfully!`);
        router.push('/campaigns');
    };

    const handleError = (error: Error) => {
        toast.error(`Failed to save: ${error.message}`);
    };

    if (existingCampaign) {
        updateCampaign({ ...existingCampaign, ...campaignData } as Campaign, {
            onSuccess: handleSuccess,
            onError: handleError,
        });
    } else {
        addCampaign(campaignData as any, {
            onSuccess: handleSuccess,
            onError: handleError,
        });
    }
  };

  const isLoading = isLoadingBases || isLoadingBots || isLoadingCampaigns;

  if (isLoading && campaignId) {
    return <div className="flex justify-center py-10"><LoadingSpinner size={40} /></div>;
  }

  return (
    <FormProvider {...form}>
      <h1 className="text-3xl font-bold tracking-tight mb-6">{existingCampaign ? 'Edit Campaign' : 'Create Campaign'}</h1>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Campaign Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Campaign Name</FormLabel>
                                    <FormControl><Input placeholder="e.g. Summer Sale 2024" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl><Textarea placeholder="A brief description of this campaign." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Message</CardTitle></CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="message.text"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MarkdownEditor 
                                                value={field.value}
                                                onChange={field.onChange}
                                                error={fieldState.error?.message}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                    
                    <ButtonEditor />
                    
                    <Card>
                        <CardHeader><CardTitle>Recipient Base</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="userBaseId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>User Base</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger>
                                            <SelectValue placeholder="Select a user base to target" />
                                        </SelectTrigger></FormControl>
                                        <SelectContent>
                                            {userBases?.map(base => (
                                                <SelectItem key={base.id} value={base.id}>{base.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        {selectedUserBase ? `This base contains ${selectedUserBase.userCount || 0} users.` : 'Select a base to see recipient count.'}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Message Preview</CardTitle></CardHeader>
                        <CardContent>
                            <TelegramPreview
                                message={form.watch('message.text')}
                                buttons={form.watch('message.buttons') as any}
                                photo={form.watch('message.photo')}
                                botName={bots?.find(b => b.id === form.watch('botId'))?.name || "Your Bot"} 
                            />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Bot</CardTitle></CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="botId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Select Bot</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a bot to send from" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {bots?.map(bot => (
                                                    <SelectItem key={bot.id} value={bot.id}>
                                                        {bot.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader><CardTitle>Image</CardTitle></CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="message.photo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <ImageUploader 
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Send Settings</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                             <FormField control={form.control} name="sendSettings.intervalMs" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Interval Between Messages</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormDescription>In milliseconds. (e.g., 500ms)</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="sendSettings.chunkSize" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Chunk Size</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormDescription>Messages sent in one batch. (1-25)</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    <Button type="submit" className="w-full" disabled={isAdding || isUpdating}>
                        {(isAdding || isUpdating) && <LoadingSpinner className="mr-2 h-4 w-4" />}
                        {existingCampaign ? 'Save Changes' : 'Create Campaign'}
                    </Button>
                </div>
            </div>
      </form>
    </FormProvider>
  );
} 