'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { PlusCircle, Trash2, Upload } from 'lucide-react';

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
import { useCallback } from 'react';

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

  // Type Guards для безопасной проверки типов
  const isApiUserBase = (ub: UserBase): ub is import('@/types').ApiUserBase => ub.type === 'api';
  const isStaticUserBase = (ub: UserBase): ub is import('@/types').StaticUserBase => ub.type === 'static';

  const form = useForm<UserBaseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: userBase ? {
      name: userBase.name,
      description: userBase.description || '',
      type: userBase.type,
      rawUserIds: isStaticUserBase(userBase) ? userBase.userIds?.join('\n') || '' : '',
      apiUrl: isApiUserBase(userBase) ? userBase.apiUrl : '',
      apiMethod: isApiUserBase(userBase) ? userBase.apiMethod || 'GET' : 'GET',
      apiHeaders: isApiUserBase(userBase) ? userBase.apiHeaders || [] : [],
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

  // Функция для загрузки файла
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем тип файла
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      alert('Пожалуйста, выберите текстовый файл (.txt)');
      return;
    }

    // Проверяем размер файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        // Устанавливаем содержимое файла в textarea
        form.setValue('rawUserIds', content);
        
        // Показываем количество найденных ID
        const userIds = content.split(/[,\s\n]+/).filter(Boolean);
        const validIds = userIds.map(id => parseInt(id.trim(), 10)).filter(Number.isFinite);
        
        if (validIds.length > 0) {
          alert(`Загружено ${validIds.length} пользователей из файла "${file.name}"`);
        } else {
          alert('В файле не найдено валидных ID пользователей');
        }
      }
    };
    
    reader.onerror = () => {
      alert('Ошибка при чтении файла');
    };
    
    reader.readAsText(file);
    
    // Очищаем input для возможности повторной загрузки того же файла
    event.target.value = '';
  }, [form]);

  const onSubmit = async (data: UserBaseFormValues) => {
    if (data.type === 'static') {
        const userIds = data.rawUserIds?.split(/[,\s\n]+/).filter(Boolean).map(id => parseInt(id.trim(), 10)).filter(Number.isFinite) || [];
        const staticPayload: Omit<import('@/types').StaticUserBase, 'id' | 'createdAt'> = {
            type: 'static',
            name: data.name,
            description: data.description,
            rawUserIds: data.rawUserIds || '',
            userIds,
            userCount: userIds.length,
            lastCheckStatus: 'success',
            lastCheckedAt: new Date()
        };
        
        if (userBase) {
            updateUserBase({ ...userBase, ...staticPayload });
        } else {
            addUserBase(staticPayload);
        }
    } else {
        const result = await testApiSource({
            apiUrl: data.apiUrl!,
            apiMethod: data.apiMethod,
            apiHeaders: data.apiHeaders
        });
        
        const apiPayload: Omit<import('@/types').ApiUserBase, 'id' | 'createdAt'> = {
            type: 'api',
            name: data.name,
            description: data.description,
            apiUrl: data.apiUrl!,
            apiMethod: data.apiMethod,
            apiHeaders: data.apiHeaders,
            userIds: result.success ? result.data : [],
            userCount: result.success ? result.userCount : 0,
            lastCheckStatus: result.success ? 'success' : 'failed',
            lastCheckedAt: new Date(),
            lastError: result.success ? undefined : result.error
        };
        
        if (userBase) {
            updateUserBase({ ...userBase, ...apiPayload });
        } else {
            addUserBase(apiPayload);
        }
    }
    
    setIsOpen(false);
  };
  
  const handleTestSource = () => {
    const formData = form.getValues();
    // Только тестируем если тип API и есть URL
    if (formData.type === 'api' && formData.apiUrl) {
      apiTester.testSource({
          apiUrl: formData.apiUrl,
          apiMethod: formData.apiMethod,
          apiHeaders: formData.apiHeaders,
      });
    }
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
                  <div className="flex items-center justify-between">
                    <FormLabel>User IDs</FormLabel>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".txt,text/plain"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="userIds-file-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('userIds-file-upload')?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload File
                      </Button>
                    </div>
                  </div>
                  <FormControl>
                      <Textarea placeholder="Enter user IDs, separated by comma, space, or new line. Or use the Upload File button above." className="min-h-[150px] font-mono" {...field} />
                  </FormControl>
                  <FormDescription>
                      {(() => {
                        const rawIds = form.watch('rawUserIds');
                        if (!rawIds) return 'Preview: ...';
                        
                        const userIds = rawIds.split(/[,\s\n]+/).filter(Boolean);
                        const validIds = userIds.map(id => parseInt(id.trim(), 10)).filter(Number.isFinite);
                        const previewIds = validIds.slice(0, 10).join(', ');
                        
                        return (
                          <span>
                            <strong>Found {validIds.length} valid IDs</strong>
                            {validIds.length > 0 && (
                              <>
                                <br />
                                Preview: {previewIds}
                                {validIds.length > 10 && '...'}
                              </>
                            )}
                          </span>
                        );
                      })()}
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