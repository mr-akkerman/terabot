'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Download, 
  Database, 
  FileCheck, 
  AlertCircle,
  CheckCircle,
  Users,
  Eye,
  BarChart3,
  X,
  File
} from 'lucide-react';
import { useUserBases } from '@/hooks/useUserBases';
import { toast } from 'sonner';

interface UploadedFile {
  id: string;
  name: string;
  type: 'json' | 'txt';
  size: number;
  userIds: number[];
}

export default function NormalizerPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [normalizedData, setNormalizedData] = useState<number[]>([]);
  const [baseName, setBaseName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastCreatedBase, setLastCreatedBase] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addUserBase } = useUserBases();

  // Обработка JSON файла
  const processJsonFile = useCallback((file: File): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const data = JSON.parse(text);
          
          if (!Array.isArray(data)) {
            throw new Error('JSON файл должен содержать массив');
          }

          const userIds: number[] = [];
          
          data.forEach((item: unknown) => {
            if (typeof item === 'number' && item > 0) {
              userIds.push(item);
            } else if (item && typeof item === 'object') {
              const obj = item as Record<string, unknown>;
              if (typeof obj.user_id === 'number' && obj.user_id > 0) {
                userIds.push(obj.user_id);
              }
            }
          });

          if (userIds.length === 0) {
            throw new Error('Не найдено валидных user_id в JSON файле');
          }

          resolve(userIds);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Ошибка парсинга JSON файла'));
        }
      };
      reader.readAsText(file);
    });
  }, []);

  // Обработка TXT файла
  const processTxtFile = useCallback((file: File): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const userIds: number[] = [];
          
          // Разделяем по запятым, переносам строк и пробелам
          const parts = text.split(/[,\n\r\s]+/);
          
          parts.forEach(part => {
            const trimmed = part.trim();
            if (trimmed && /^\d+$/.test(trimmed)) {
              const id = parseInt(trimmed, 10);
              if (id > 0) {
                userIds.push(id);
              }
            }
          });

          if (userIds.length === 0) {
            throw new Error('Не найдено валидных user_id в TXT файле');
          }

          resolve(userIds);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Ошибка парсинга TXT файла'));
        }
      };
      reader.readAsText(file);
    });
  }, []);

  // Обработка файла
  const processFile = useCallback(async (file: File) => {
    const fileId = `${file.name}_${Date.now()}`;
    
    try {
      setIsProcessing(true);
      let userIds: number[] = [];

      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        userIds = await processJsonFile(file);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        userIds = await processTxtFile(file);
      } else {
        throw new Error('Поддерживаются только JSON и TXT файлы');
      }

      const uploadedFile: UploadedFile = {
        id: fileId,
        name: file.name,
        type: file.name.endsWith('.json') ? 'json' : 'txt',
        size: file.size,
        userIds
      };

      setUploadedFiles(prev => [...prev, uploadedFile]);
      setUploadError(null);
      
      toast.success(`Загружен файл "${file.name}" с ${userIds.length} пользователями`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Ошибка обработки файла');
      toast.error(`Ошибка в файле "${file.name}": ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [processJsonFile, processTxtFile]);

  // Обработка множественных файлов
  const processFiles = useCallback(async (files: FileList) => {
    const validFiles = Array.from(files).filter(file => {
      const isJson = file.type === 'application/json' || file.name.endsWith('.json');
      const isTxt = file.type === 'text/plain' || file.name.endsWith('.txt');
      return isJson || isTxt;
    });

    if (validFiles.length === 0) {
      setUploadError('Пожалуйста, выберите JSON или TXT файлы');
      return;
    }

    for (const file of validFiles) {
      await processFile(file);
    }
  }, [processFile]);

  // Обработка drag&drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  // Обработка загрузки файлов
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    processFiles(files);
  }, [processFiles]);

  // Удаление файла
  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    toast.success('Файл удален');
  }, []);

  // Нормализация данных - объединение и удаление дубликатов
  const normalizeData = useCallback(() => {
    if (uploadedFiles.length === 0) {
      setNormalizedData([]);
      return;
    }

    // Собираем все ID из всех файлов
    const allUserIds: number[] = [];
    uploadedFiles.forEach(file => {
      allUserIds.push(...file.userIds);
    });

    // Удаляем дубликаты и сортируем
    const uniqueUserIds = [...new Set(allUserIds)].sort((a, b) => a - b);
    
    setNormalizedData(uniqueUserIds);
  }, [uploadedFiles]);

  // Автоматическая нормализация при изменении файлов
  useEffect(() => {
    normalizeData();
  }, [normalizeData]);

  // Статистика
  const totalOriginalIds = uploadedFiles.reduce((sum, file) => sum + file.userIds.length, 0);
  const duplicatesRemoved = totalOriginalIds - normalizedData.length;

  // Сохранение в базу пользователей
  const handleSaveToUserBase = useCallback(async () => {
    if (normalizedData.length === 0 || !baseName.trim()) {
      toast.error('Укажите имя базы');
      return;
    }

    try {
      setIsProcessing(true);
      
      const userBase = {
        type: 'static' as const,
        name: baseName.trim(),
        description: `Нормализованная база из ${uploadedFiles.length} файлов (${normalizedData.length} уникальных пользователей)`,
        rawUserIds: normalizedData.join(','),
        userIds: normalizedData,
        userCount: normalizedData.length,
        lastCheckStatus: 'success' as const,
        lastCheckedAt: new Date(),
      };
      
      await addUserBase(userBase);
      
      // Успешное создание базы
      toast.success(`✅ База "${baseName.trim()}" успешно создана!`, {
        description: `Добавлено ${normalizedData.length.toLocaleString()} уникальных пользователей`,
        duration: 5000,
      });
      
      // Очищаем поле имени после успешного создания
      setLastCreatedBase(baseName.trim());
      setBaseName('');
      
    } catch (error) {
      toast.error('❌ Ошибка при создании базы');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }, [normalizedData, baseName, uploadedFiles.length, addUserBase]);

  // Скачивание JSON файла
  const handleDownloadJson = useCallback(() => {
    if (normalizedData.length === 0) {
      toast.error('Нет данных для скачивания');
      return;
    }

    try {
      // Экспортируем только чистый массив ID для совместимости с другими инструментами
      const blob = new Blob([JSON.stringify(normalizedData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const fileName = baseName.trim() 
        ? `${baseName.trim()}_normalized.json`
        : `normalized_users_${new Date().toISOString().split('T')[0]}.json`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      toast.success(`Файл "${fileName}" скачан`);
    } catch (error) {
      toast.error('Ошибка при скачивании файла');
      console.error(error);
    }
  }, [normalizedData, baseName, uploadedFiles, totalOriginalIds, duplicatesRemoved]);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Нормализатор базы</h1>
        <p className="text-muted-foreground mt-2">
          Объедините несколько файлов с ID пользователей, удалите дубликаты и создайте чистую базу
        </p>
      </div>

      {/* Загрузка файлов */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Загрузка файлов
          </CardTitle>
          <CardDescription>
            Выберите или перетащите JSON и TXT файлы с ID пользователей
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              Перетащите JSON или TXT файлы сюда
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              или нажмите кнопку ниже для выбора файлов
            </p>
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? 'Обработка...' : 'Выбрать файлы'}
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              multiple
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="hidden"
            />
          </div>
          
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Список загруженных файлов */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <File className="h-5 w-5" />
              Загруженные файлы ({uploadedFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={file.type === 'json' ? 'default' : 'secondary'}>
                      {file.type.toUpperCase()}
                    </Badge>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {file.userIds.length} пользователей • {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
                     </CardContent>
         </Card>
       )}

       {/* Статистика нормализации */}
       {normalizedData.length > 0 && (
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <BarChart3 className="h-5 w-5" />
               Результат нормализации
             </CardTitle>
             <CardDescription>
               Статистика объединения и очистки данных
             </CardDescription>
           </CardHeader>
           <CardContent>
             <div className="grid gap-4 md:grid-cols-3">
               <div className="text-center p-4 bg-muted/50 rounded-lg">
                 <div className="text-2xl font-bold text-primary">{totalOriginalIds.toLocaleString()}</div>
                 <div className="text-sm text-muted-foreground">Всего загружено</div>
               </div>
               <div className="text-center p-4 bg-muted/50 rounded-lg">
                 <div className="text-2xl font-bold text-destructive">{duplicatesRemoved.toLocaleString()}</div>
                 <div className="text-sm text-muted-foreground">Дубликатов удалено</div>
               </div>
               <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                 <div className="text-2xl font-bold text-green-600">{normalizedData.length.toLocaleString()}</div>
                 <div className="text-sm text-green-600">Уникальных пользователей</div>
               </div>
             </div>
             
             {duplicatesRemoved > 0 && (
               <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                 <div className="flex items-center gap-2 text-yellow-800">
                   <CheckCircle className="h-4 w-4" />
                   <span className="text-sm font-medium">
                     Удалено {duplicatesRemoved} дубликатов ({((duplicatesRemoved / totalOriginalIds) * 100).toFixed(1)}% от общего количества)
                   </span>
                 </div>
               </div>
             )}
           </CardContent>
         </Card>
       )}

       {/* Предварительный просмотр результата */}
       {normalizedData.length > 0 && (
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Eye className="h-5 w-5" />
               Предварительный просмотр
             </CardTitle>
             <CardDescription>
               Первые ID из нормализованной базы
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <Button 
               variant="outline" 
               size="sm"
               onClick={() => setShowPreview(!showPreview)}
             >
               {showPreview ? 'Скрыть' : 'Показать'} данные
             </Button>
             
             {showPreview && (
               <div className="bg-muted/50 rounded-lg p-4">
                 <div className="text-sm font-mono space-y-1 max-h-40 overflow-y-auto">
                   {normalizedData.slice(0, 20).map((id, index) => (
                     <div key={index} className="text-green-700">
                       {id}
                     </div>
                   ))}
                   {normalizedData.length > 20 && (
                     <div className="text-muted-foreground">
                       ... и еще {normalizedData.length - 20} пользователей
                     </div>
                   )}
                 </div>
               </div>
             )}
                        </CardContent>
           </Card>
         )}

         {/* Экспорт и сохранение */}
         {normalizedData.length > 0 && (
           <div className="grid gap-4 md:grid-cols-2">
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <Database className="h-5 w-5" />
                   Сохранить в базу пользователей
                 </CardTitle>
                 <CardDescription>
                   Создать новую базу рассылок с нормализованными данными
                 </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="grid w-full items-center gap-1.5">
                   <Label htmlFor="base-name">Имя базы</Label>
                   <Input
                     id="base-name"
                     type="text"
                     value={baseName}
                     onChange={(e) => setBaseName(e.target.value)}
                     placeholder="Например: Нормализованная база"
                     disabled={isProcessing}
                   />
                   <p className="text-sm text-muted-foreground">
                     Имя для создаваемой базы пользователей
                   </p>
                 </div>
                 
                 <Button 
                   onClick={handleSaveToUserBase}
                   disabled={isProcessing || !baseName.trim()}
                   className="w-full"
                 >
                   <Database className="h-4 w-4 mr-2" />
                   {isProcessing ? 'Создание...' : 'Создать базу'}
                 </Button>
                 
                 <div className="text-sm text-muted-foreground">
                   Будет создана база с {normalizedData.length.toLocaleString()} пользователями
                 </div>
                 
                 {lastCreatedBase && (
                   <Alert>
                     <CheckCircle className="h-4 w-4" />
                     <AlertDescription>
                       ✅ База "<strong>{lastCreatedBase}</strong>" успешно создана и добавлена в список баз пользователей!
                     </AlertDescription>
                   </Alert>
                 )}
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <Download className="h-5 w-5" />
                   Скачать JSON файл
                 </CardTitle>
                 <CardDescription>
                   Экспортировать чистый JSON массив с ID пользователей
                 </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="space-y-2">
                   <p className="text-sm">
                     <strong>Содержимое файла:</strong>
                   </p>
                   <ul className="text-sm text-muted-foreground space-y-1">
                     <li>• Чистый массив уникальных user_id</li>
                     <li>• Совместим с другими инструментами</li>
                     <li>• Готов для импорта в массовый импорт</li>
                   </ul>
                 </div>
                 
                 <Button 
                   onClick={handleDownloadJson}
                   disabled={isProcessing}
                   variant="outline"
                   className="w-full"
                 >
                   <Download className="h-4 w-4 mr-2" />
                   Скачать JSON
                 </Button>
                 
                 <div className="text-sm text-muted-foreground">
                   Файл: {baseName.trim() ? `${baseName.trim()}_normalized.json` : `normalized_users_${new Date().toISOString().split('T')[0]}.json`}
                 </div>
               </CardContent>
             </Card>
           </div>
         )}
       </div>
     );
} 