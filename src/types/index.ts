/**
 * Настройки отправки для рассылки.
 */
export interface SendSettings {
  intervalMs: number; // Интервал между сообщениями в мс
  chunkSize: number;  // Количество сообщений в одной "пачке"
}

/**
 * Кнопка для Telegram сообщения (Inline Keyboard).
 * Может быть либо URL-кнопкой, либо callback-кнопкой.
 */
export type CampaignMessageButton = {
  id: string; // Уникальный ID кнопки
  text: string; // Текст на кнопке
} & ({
  type: 'url';
  url: string; // URL, который откроется при нажатии
} | {
  type: 'callback';
  callback_data: string; // Данные, которые будут отправлены боту
});

/**
 * Сообщение для рассылки.
 */
export interface CampaignMessage {
  id: string; // Уникальный ID
  text: string; // Текст сообщения с HTML-тегами
  parse_mode: 'HTML'; // Режим парсинга в Telegram
  photo?: string; // Изображение в формате base64
  buttons?: CampaignMessageButton[][]; // Клавиатура (массив рядов кнопок)
}

/**
 * База пользователей для рассылки.
 * Может быть статическим списком ID или загружаться по API.
 */
export type UserBase = StaticUserBase | ApiUserBase;

interface BaseUserBase {
  id: string;
  name:string;
  description?: string;
  userCount?: number;
  lastError?: string;
  lastCheckStatus?: 'success' | 'failed' | 'pending';
  lastCheckedAt?: Date;
  createdAt: Date;
}

export interface StaticUserBase extends BaseUserBase {
    type: 'static';
    rawUserIds: string; // "Сырой" текст из textarea
    userIds?: number[]; // Обработанные и валидные ID
}

export interface ApiUserBase extends BaseUserBase {
    type: 'api';
    apiUrl: string;
    apiMethod?: 'GET' | 'POST';
    apiHeaders?: { key: string; value: string }[];
    // Поле userIds будет заполнено после загрузки
    userIds?: number[];
}

/**
 * Результат отправки сообщения одному пользователю.
 */
export interface SendResult {
  userId: number;
  status: 'success' | 'failed';
  error?: string; // Сообщение об ошибке, если отправка не удалась
  timestamp: Date;
}

/**
 * Информация о сохраненном боте.
 */
export interface Bot {
  id: string; // Уникальный ID
  name: string; // Имя для идентификации
  token: string; // Токен Telegram бота
  lastCheckStatus?: 'success' | 'failed' | 'pending';
  lastCheckedAt?: Date;
  lastError?: string;
}

/**
 * Прогресс выполнения рассылки.
 */
export interface CampaignProgress {
  campaignId: string;
  totalUsers: number;
  sentCount: number;
  failedCount: number;
  results: SendResult[];
}

/**
 * Основная сущность рассылки.
 */
export interface Campaign {
  id: string; // Уникальный ID
  name: string; // Название для удобства
  description?: string; // Описание
  botId: string; // ID связанного бота
  message: CampaignMessage; // Сообщение для рассылки
  userBaseId: string; // ID связанной базы пользователей
  sendSettings: SendSettings; // Настройки отправки
  createdAt: Date; // Дата создания
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped'; // Текущий статус
  progress?: CampaignProgress; // Прогресс выполнения
}
