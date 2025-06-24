'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Download, 
  Database, 
  Settings, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Users,
  Eye,
  BarChart3,
  Clock
} from 'lucide-react';
import { useUserBases } from '@/hooks/useUserBases';
import { toast } from 'sonner';

interface UserData {
  user_id: number;
}

interface ProcessingProgress {
  current: number;
  total: number;
  type: 'export' | 'create';
}

export default function MassImportPage() {
  const [jsonData, setJsonData] = useState<UserData[]>([]);
  const [chunkSize, setChunkSize] = useState(30000);
  const [baseName, setBaseName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addUserBase } = useUserBases();

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
    
    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(file => file.type === 'application/json');
    
    if (jsonFile) {
      processFile(jsonFile);
    } else {
      setUploadError('Пожалуйста, перетащите JSON файл');
    }
  }, []);

  // Общая функция обработки файла
  const processFile = useCallback((file: File) => {
    if (file.type !== 'application/json') {
      setUploadError('Пожалуйста, выберите JSON файл');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        
        // Валидация структуры данных
        if (!Array.isArray(data)) {
          throw new Error('JSON файл должен содержать массив объектов');
        }

        const validData = data.filter((item: any) => 
          item && typeof item.user_id === 'number' && item.user_id > 0
        );

        if (validData.length === 0) {
          throw new Error('Не найдено валидных user_id в файле');
        }

        const invalidCount = data.length - validData.length;
        
        setJsonData(validData);
        setUploadError(null);
        
        toast.success(
          `Загружено ${validData.length} пользователей` + 
          (invalidCount > 0 ? ` (пропущено ${invalidCount} невалидных)` : '')
        );
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Ошибка парсинга JSON файла');
        setJsonData([]);
      }
    };

    reader.readAsText(file);
  }, []);

  // Обработка загрузки файла
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  }, [processFile]);

  // Разбивка данных на чанки
  const createChunks = useCallback(() => {
    const chunks: UserData[][] = [];
    for (let i = 0; i < jsonData.length; i += chunkSize) {
      chunks.push(jsonData.slice(i, i + chunkSize));
    }
    return chunks;
  }, [jsonData, chunkSize]);

  // Экспорт в JSON файлы с прогрессом
  const handleExportFiles = useCallback(async () => {
    if (jsonData.length === 0) return;

    setIsProcessing(true);
    const chunks = createChunks();
    setProcessingProgress({ current: 0, total: chunks.length, type: 'export' });
    
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const userIds = chunk.map(item => item.user_id).join(',');
        
        const blob = new Blob([userIds], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const fileName = baseName.trim() 
          ? `${baseName.trim()}_chunk_${i + 1}_of_${chunks.length}.txt`
          : `user_ids_chunk_${i + 1}_of_${chunks.length}.txt`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        setProcessingProgress({ current: i + 1, total: chunks.length, type: 'export' });
        
        // Небольшая задержка между скачиваниями
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      toast.success(`Скачано ${chunks.length} файлов`);
    } catch (error) {
      toast.error('Ошибка при экспорте файлов');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  }, [jsonData, createChunks]);

  // Создание готовых баз рассылок с прогрессом
  const handleCreateUserBases = useCallback(async () => {
    if (jsonData.length === 0) return;

    setIsProcessing(true);
    const chunks = createChunks();
    setProcessingProgress({ current: 0, total: chunks.length, type: 'create' });
    
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const userIds = chunk.map(item => item.user_id).join(',');
        
        const userName = baseName.trim() 
          ? `${baseName.trim()}_${i + 1}`
          : `Импорт база ${i + 1} из ${chunks.length}`;
        
        const userBase = {
          type: 'static' as const,
          name: userName,
          description: `Автоматически созданная база из ${chunk.length} пользователей`,
          rawUserIds: userIds,
          userIds: chunk.map(item => item.user_id),
          userCount: chunk.length,
        };
        
        addUserBase(userBase);
        
        setProcessingProgress({ current: i + 1, total: chunks.length, type: 'create' });
        
        // Небольшая задержка между созданием баз
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      toast.success(`Создано ${chunks.length} баз рассылок`);
    } catch (error) {
      toast.error('Ошибка при создании баз');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  }, [jsonData, createChunks, addUserBase]);

  const chunks = jsonData.length > 0 ? createChunks() : [];
  const averageChunkSize = chunks.length > 0 ? Math.floor(jsonData.length / chunks.length) : 0;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Массовый импорт баз</h1>
        <p className="text-muted-foreground mt-2">
          Импортируйте большие JSON файлы с пользователями и разбейте их на удобные чанки
        </p>
      </div>

      {/* Загрузка файла с drag&drop */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Загрузка JSON файла
          </CardTitle>
          <CardDescription>
            Выберите или перетащите JSON файл с массивом объектов, содержащих user_id
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag&Drop зона */}
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
              Перетащите JSON файл сюда
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              или нажмите кнопку ниже для выбора файла
            </p>
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              Выбрать файл
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".json"
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

          {jsonData.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Успешно загружено <strong>{jsonData.length}</strong> пользователей
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Предварительный просмотр данных */}
      {jsonData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Предварительный просмотр
            </CardTitle>
            <CardDescription>
              Первые несколько записей из загруженного файла
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
                <div className="text-sm font-mono space-y-1">
                  {jsonData.slice(0, 10).map((item, index) => (
                    <div key={index}>
                      {item.user_id}
                    </div>
                  ))}
                  {jsonData.length > 10 && (
                    <div className="text-muted-foreground">
                      ... и еще {jsonData.length - 10} записей
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Настройки и статистика */}
      {jsonData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Настройки разбивки
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="base-name">Базовое имя</Label>
                  <Input
                    id="base-name"
                    type="text"
                    value={baseName}
                    onChange={(e) => setBaseName(e.target.value)}
                    placeholder="Например: all_users"
                    disabled={isProcessing}
                  />
                  <p className="text-sm text-muted-foreground">
                    Имя для создаваемых баз и файлов (например: all_users_1, all_users_2...)
                  </p>
                </div>
                
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="chunk-size">Размер чанка</Label>
                  <Input
                    id="chunk-size"
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    min={1}
                    max={100000}
                    disabled={isProcessing}
                  />
                  <p className="text-sm text-muted-foreground">
                    Количество пользователей в одном чанке (по умолчанию 30,000)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Статистика разбивки
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Всего пользователей:</span>
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {jsonData.length.toLocaleString()}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Количество чанков:</span>
                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  {chunks.length}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Средний размер чанка:</span>
                <Badge variant="outline">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  {averageChunkSize.toLocaleString()}
                </Badge>
              </div>
              {chunks.length > 0 && chunks[chunks.length - 1].length !== averageChunkSize && (
                <div className="flex justify-between text-sm">
                  <span>Последний чанк:</span>
                  <Badge variant="secondary">
                    {chunks[chunks.length - 1].length.toLocaleString()}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Действия */}
      {jsonData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Экспорт в файлы
              </CardTitle>
                          <CardDescription>
              Скачать {chunks.length} текстовых файлов с ID через запятую
              {baseName.trim() && (
                <span className="block text-xs mt-1 text-primary">
                  Файлы: {baseName.trim()}_chunk_1_of_{chunks.length}.txt, ...
                </span>
              )}
            </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleExportFiles} 
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing && processingProgress?.type === 'export' 
                  ? `Экспорт... (${processingProgress.current}/${processingProgress.total})` 
                  : `Скачать ${chunks.length} файлов`
                }
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Создать базы рассылок
              </CardTitle>
                          <CardDescription>
              Создать {chunks.length} готовых баз в системе
              {baseName.trim() && (
                <span className="block text-xs mt-1 text-primary">
                  Базы: {baseName.trim()}_1, {baseName.trim()}_2, ...
                </span>
              )}
            </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleCreateUserBases} 
                disabled={isProcessing}
                className="w-full"
                variant="outline"
              >
                {isProcessing && processingProgress?.type === 'create'
                  ? `Создание... (${processingProgress.current}/${processingProgress.total})`
                  : `Создать ${chunks.length} баз`
                }
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Детальный прогресс */}
      {isProcessing && processingProgress && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {processingProgress.type === 'export' ? 'Экспорт файлов' : 'Создание баз'}
                </span>
                <span>
                  {processingProgress.current} из {processingProgress.total}
                </span>
              </div>
              <Progress 
                value={(processingProgress.current / processingProgress.total) * 100} 
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center">
                {Math.round((processingProgress.current / processingProgress.total) * 100)}% завершено
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 