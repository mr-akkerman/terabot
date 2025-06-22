import pRetry, { AbortError } from 'p-retry';
import type {
  User,
  Message,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
  ForceReply,
} from 'typegram';

// --- Custom Error Types ---

export class TelegramApiError extends Error {
  constructor(
    public readonly error_code: number,
    public readonly description: string,
  ) {
    super(`[${error_code}] ${description}`);
    this.name = 'TelegramApiError';
  }
}

// --- Payload Types ---

export type SendMessagePayload = {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'MarkdownV2';
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
};

export type SendPhotoPayload = {
  chat_id: number | string;
  photo: string; // URL or base64 data URL
  caption?: string;
  parse_mode?: 'HTML' | 'MarkdownV2';
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;
};

// --- Helper Functions ---

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}


// --- Main API Class ---

export class TelegramAPI {
  private readonly baseUrl: string;

  constructor(
    private token: string,
    private options: { logger?: (msg: string) => void } = {},
  ) {
    if (!token) {
      throw new Error('Telegram Bot Token is required.');
    }
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  private log(message: string) {
    this.options.logger?.(`[TGBotAPI] ${message}`);
  }

  private async request<T>(method: string, payload?: object): Promise<T> {
    const url = `${this.baseUrl}/${method}`;
    const body = payload ? JSON.stringify(payload) : undefined;
    
    const run = async () => {
      this.log(`Requesting '${method}'...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const errorData = await response.json();
          throw new AbortError(new TelegramApiError(errorData.error_code, errorData.description));
        }
        throw new Error(`[${response.status}] ${response.statusText}`);
      }
      
      const data = await response.json();
      this.log(`Request '${method}' successful.`);
      return data.result as T;
    };
    
    return pRetry(run, {
        retries: 3,
        minTimeout: 1000,
        factor: 2,
        onFailedAttempt: error => {
            this.log(`Attempt ${error.attemptNumber} failed for '${method}'. Retries left: ${error.retriesLeft}. Error: ${error.message}`);
        }
    });
  }

  public getMe(): Promise<User> {
    return this.request<User>('getMe');
  }
  
  public sendMessage(payload: SendMessagePayload): Promise<Message> {
    return this.request<Message>('sendMessage', payload);
  }

  public async sendPhoto(payload: SendPhotoPayload): Promise<Message> {
    const formData = new FormData();
    formData.append('chat_id', payload.chat_id.toString());
    
    if (payload.caption) formData.append('caption', payload.caption);
    if (payload.parse_mode) formData.append('parse_mode', payload.parse_mode);
    if (payload.reply_markup) formData.append('reply_markup', JSON.stringify(payload.reply_markup));

    if (payload.photo.startsWith('http')) {
        formData.append('photo', payload.photo);
    } else {
        const photoBlob = await dataUrlToBlob(payload.photo);
        formData.append('photo', photoBlob, 'photo.png');
    }

    const url = `${this.baseUrl}/sendPhoto`;
    
    const run = async () => {
        this.log(`Requesting 'sendPhoto' with FormData...`);
        const response = await fetch(url, { method: 'POST', body: formData });
        
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errorData = await response.json();
            throw new AbortError(new TelegramApiError(errorData.error_code, errorData.description));
          }
          throw new Error(`[${response.status}] ${response.statusText}`);
        }
        
        const data = await response.json();
        this.log(`Request 'sendPhoto' successful.`);
        return data.result as Message;
    };
    
    return pRetry(run, {
        retries: 3,
        minTimeout: 1000,
        factor: 2,
        onFailedAttempt: error => {
            this.log(`Attempt ${error.attemptNumber} failed for 'sendPhoto'. Retries left: ${error.retriesLeft}. Error: ${error.message}`);
        }
    });
  }
} 