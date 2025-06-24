'use client';

import { useState, useCallback } from 'react';
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
  Users
} from 'lucide-react';
import { useUserBases } from '@/hooks/useUserBases';
import { toast } from 'sonner';

interface UserData {
  user_id: number;
}

export default function MassImportPage() {
  const [jsonData, setJsonData] = useState<UserData[]>([]);
  const [chunkSize, setChunkSize] = useState(30000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { addUserBase } = useUserBases();

  // Обработка загрузки файла
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

        setJsonData(validData);
        setUploadError(null);
        toast.success(`Загружено ${validData.length} пользователей`);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Ошибка парсинга JSON файла');
        setJsonData([]);
      }
    };

    reader.readAsText(file);
  }, []);

  // Разбивка данных на чанки
  const createChunks = useCallback(() => {
    const chunks: UserData[][] = [];
    for (let i = 0; i < jsonData.length; i += chunkSize) {
      chunks.push(jsonData.slice(i, i + chunkSize));
    }
    return chunks;
  }, [jsonData, chunkSize]);

  // Экспорт в JSON файлы
  const handleExportFiles = useCallback(async () => {
    if (jsonData.length === 0) return;

    setIsProcessing(true);
    try {
      const chunks = createChunks();
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const userIds = chunk.map(item => item.user_id).join(',');
        
        const blob = new Blob([userIds], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `user_ids_chunk_${i + 1}_of_${chunks.length}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        // Небольшая задержка между скачиваниями
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      toast.success(`Скачано ${chunks.length} файлов`);
    } catch (error) {
      toast.error('Ошибка при экспорте файлов');
    } finally {
      setIsProcessing(false);
    }
  }, [jsonData, createChunks]);

  // Создание готовых баз рассылок
  const handleCreateUserBases = useCallback(async () => {
    if (jsonData.length === 0) return;

    setIsProcessing(true);
    try {
      const chunks = createChunks();
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const userIds = chunk.map(item => item.user_id).join(',');
        
        const userBase = {
          type: 'static' as const,
          name: `Импорт база ${i + 1} из ${chunks.length}`,
          description: `Автоматически созданная база из ${chunk.length} пользователей`,
          rawUserIds: userIds,
          userIds: chunk.map(item => item.user_id),
          userCount: chunk.length,
        };
        
        addUserBase(userBase);
        
        // Небольшая задержка между созданием баз
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      toast.success(`Создано ${chunks.length} баз рассылок`);
    } catch (error) {
      toast.error('Ошибка при создании баз');
    } finally {
      setIsProcessing(false);
    }
  }, [jsonData, createChunks, addUserBase]);

  const chunks = jsonData.length > 0 ? createChunks() : [];

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Массовый импорт баз</h1>
        <p className="text-muted-foreground mt-2">
          Импортируйте большие JSON файлы с пользователями и разбейте их на удобные чанки
        </p>
      </div>

      {/* Загрузка файла */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Загрузка JSON файла
          </CardTitle>
          <CardDescription>
            Выберите JSON файл с массивом объектов, содержащих user_id
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="json-file">JSON файл</Label>
            <Input
              id="json-file"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={isProcessing}
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

      {/* Настройки */}
      {jsonData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Настройки разбивки
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
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

            <div className="flex gap-4 text-sm">
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                Всего: {jsonData.length}
              </Badge>
              <Badge variant="outline">
                <FileText className="h-3 w-3 mr-1" />
                Чанков: {chunks.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
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
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleExportFiles} 
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? 'Экспорт...' : `Скачать ${chunks.length} файлов`}
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
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleCreateUserBases} 
                disabled={isProcessing}
                className="w-full"
                variant="outline"
              >
                {isProcessing ? 'Создание...' : `Создать ${chunks.length} баз`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Прогресс */}
      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Обработка...</span>
                <span>Пожалуйста, подождите</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 