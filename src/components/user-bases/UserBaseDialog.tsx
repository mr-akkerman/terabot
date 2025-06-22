'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Form,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUserBases } from '@/hooks';
import { useApiTester } from '@/hooks/useApiTester';
import { testApiSource } from '@/utils/api';
import type { UserBase } from '@/types';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '../ui/LoadingSpinner';

// Схема валидации
const formSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }),
  description: z.string().optional(),
  type: z.enum(['static', 'api']),
  rawUserIds: z.string().optional(),
  apiUrl: z.string().optional(),
  apiMethod: z.enum(['GET', 'POST']),
  apiHeaders: z.array(z.object({
    key: z.string().min(1),
    value: z.string().min(1),
  })).optional(),
}).refine(data => {
  if (data.type === 'static') return !!data.rawUserIds && data.rawUserIds.trim() !== '';
  return true;
}, { message: 'User IDs are required for static type', path: ['rawUserIds'] })
.refine(data => {
    if (data.type === 'api') return !!data.apiUrl && z.string().url().safeParse(data.apiUrl).success;
    return true;
}, { message: 'A valid URL is required for API type', path: ['apiUrl'] });

type UserBaseFormValues = z.infer<typeof formSchema>;

interface UserBaseDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userBase?: UserBase; // Existing user base for editing
}

function UserBaseFormContent({ userBase, setIsOpen }: { userBase?: UserBase, setIsOpen: (isOpen: boolean) => void }) {
  const { addUserBase, updateUserBase } = useUserBases();
  const apiTester = useApiTester();

  const form = useForm<UserBaseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: userBase ? {
      name: userBase.name,
      description: userBase.description || '',
      type: userBase.type,
      rawUserIds: userBase.type === 'static' ? userBase.userIds?.join('\n') : '',
      apiUrl: userBase.apiUrl || '',
      apiMethod: userBase.apiMethod || 'GET',
      apiHeaders: userBase.apiHeaders || [],
    } : {
      name: '',
      description: '',
      type: 'static',
      rawUserIds: '',
      apiUrl: '',
      apiMethod: 'GET',
      apiHeaders: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "apiHeaders",
  });

  const watchType = form.watch('type');

  const onSubmit = async (data: UserBaseFormValues) => {
    let finalPayload: Partial<UserBase> = { ...data };

    if (data.type === 'static') {
        const userIds = data.rawUserIds?.split(/[,\\s\\n]+/).filter(Boolean).map(id => parseInt(id.trim(), 10)).filter(Number.isFinite) || [];
        finalPayload = { ...finalPayload, userIds, userCount: userIds.length, lastCheckStatus: 'success', lastCheckedAt: new Date() };
    } else {
        const result = await testApiSource(data as any);
        if (result.success) {
            finalPayload = { ...finalPayload, userIds: result.data, userCount: result.userCount, lastCheckStatus: 'success', lastCheckedAt: new Date(), lastError: undefined };
        } else {
            finalPayload = { ...finalPayload, userIds: [], userCount: 0, lastCheckStatus: 'failed', lastCheckedAt: new Date(), lastError: result.error };
        }
    }
    
    if (userBase) {
      updateUserBase({ ...userBase, ...finalPayload });
    } else {
      addUserBase(finalPayload as Omit<UserBase, 'id' | 'createdAt'>);
    }
    setIsOpen(false);
  };
  
  const handleTestSource = () => {
    const formData = form.getValues();
    apiTester.testSource({
        apiUrl: formData.apiUrl,
        apiMethod: formData.apiMethod,
        apiHeaders: formData.apiHeaders,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{userBase ? 'Edit' : 'Create'} User Base</DialogTitle>
        <DialogDescription>
          Fill in the details for your user base. Click save when you&apos;re done.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Premium Subscribers" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="A brief description of this user base." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a source type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="static">Static List</SelectItem>
                    <SelectItem value="api">API Endpoint</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className={cn('space-y-4 transition-all', watchType === 'static' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden')}>
              <FormField
              control={form.control}
              name="rawUserIds"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>User IDs</FormLabel>
                  <FormControl>
                      <Textarea placeholder="Enter user IDs, separated by comma, space, or new line" className="min-h-[150px] font-mono" {...field} />
                  </FormControl>
                  <FormDescription>
                      Preview: {form.watch('rawUserIds')?.split(/[,\\s\\n]+/).filter(Boolean).slice(0, 10).join(', ') || '...'}
                  </FormDescription>
                  <FormMessage />
                  </FormItem>
              )}
              />
          </div>
          
          <div className={cn('space-y-4 transition-all', watchType === 'api' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden')}>
              <FormField
              control={form.control}
              name="apiUrl"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>API URL</FormLabel>
                  <FormControl>
                      <Input placeholder="https://api.example.com/users" {...field} />
                  </FormControl>
                  <FormMessage />
                  </FormItem>
              )}
              />

              <FormField
                  control={form.control}
                  name="apiMethod"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                  )}
              />

              <div className="space-y-2">
                  <FormLabel>Headers</FormLabel>
                  {fields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-2">
                          <FormField
                              control={form.control}
                              name={`apiHeaders.${index}.key`}
                              render={({ field }) => (
                                  <Input {...field} placeholder="Key" />
                              )}
                          />
                          <FormField
                              control={form.control}
                              name={`apiHeaders.${index}.value`}
                              render={({ field }) => (
                                  <Input {...field} placeholder="Value" />
                              )}
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>
                  ))}
                  <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ key: '', value: '' })}
                  >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Header
                  </Button>
              </div>

               <div className="border-t pt-4">
                  <Button type="button" onClick={handleTestSource} disabled={apiTester.isLoading}>
                      {apiTester.isLoading && <LoadingSpinner className="mr-2 h-4 w-4" />}
                      Test Source
                  </Button>
                  {apiTester.result && (
                      <div className={cn(
                          "mt-2 text-sm p-2 rounded-md",
                          apiTester.result.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      )}>
                          {apiTester.result.message}
                      </div>
                  )}
              </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Form>
    </>
  );
}

export function UserBaseDialog({ isOpen, setIsOpen, userBase }: UserBaseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl" key={userBase?.id || 'new'}>
        <UserBaseFormContent userBase={userBase} setIsOpen={setIsOpen} />
      </DialogContent>
    </Dialog>
  );
} 