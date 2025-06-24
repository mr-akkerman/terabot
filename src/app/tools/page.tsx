'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Upload, FileCheck } from 'lucide-react';

export default function ToolsPage() {
  const tools = [
    {
      id: 'mass-import',
      title: 'Массовый импорт баз',
      description: 'Импорт больших JSON файлов с пользователями, разбивка на чанки и создание готовых баз рассылок',
      icon: Database,
      href: '/tools/mass-import',
      features: [
        'Импорт JSON файлов с user_id',
        'Разбивка на настраиваемые чанки',
        'Экспорт в готовые базы рассылок',
        'Скачивание файлов по чанкам'
      ]
    },
    {
      id: 'normalizer',
      title: 'Нормализатор базы',
      description: 'Объединение нескольких файлов с ID пользователей, удаление дубликатов и создание чистой базы',
      icon: FileCheck,
      href: '/tools/normalizer',
      features: [
        'Импорт JSON и TXT файлов',
        'Автоматическое удаление дубликатов',
        'Объединение баз в одну',
        'Сохранение или скачивание результата'
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Инструменты</h1>
        <p className="text-muted-foreground mt-2">
          Полезные инструменты для работы с рассылками и базами пользователей
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.id} href={tool.href}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <tool.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{tool.title}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {tool.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {tool.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="h-1 w-1 bg-primary rounded-full" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Больше инструментов скоро</h3>
          <p className="text-muted-foreground text-center">
            Мы постоянно добавляем новые полезные инструменты для упрощения работы с рассылками
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 