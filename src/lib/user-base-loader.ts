import type { UserBase, ApiUserBase } from '@/types';

// Простой кеш в памяти, чтобы избежать повторных API-запросов в рамках сессии
const apiCache = new Map<string, { data: number[], timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут

export type LoaderStatus = 'idle' | 'loading' | 'success' | 'error';
export type OnProgressCallback = (status: LoaderStatus, message?: string) => void;

export class UserBaseLoader {
  private userBase: UserBase;
  private onProgress: OnProgressCallback;

  constructor(userBase: UserBase, onProgress: OnProgressCallback = () => {}) {
    this.userBase = userBase;
    this.onProgress = onProgress;
  }

  public async loadUserIds(): Promise<number[]> {
    this.onProgress('loading', 'Starting user IDs loading...');
    try {
      let userIds: number[] = [];

      if (this.userBase.type === 'static') {
        this.onProgress('loading', 'Parsing static user list...');
        userIds = this.parseStaticIds(this.userBase.rawUserIds);
      } else if (this.userBase.type === 'api') {
        this.onProgress('loading', `Fetching from API: ${this.userBase.apiUrl}`);
        userIds = await this.fetchApiIds(this.userBase);
      }
      
      this.onProgress('success', `Successfully loaded ${userIds.length} user IDs.`);
      return userIds;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      this.onProgress('error', `Failed to load user IDs: ${errorMessage}`);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  private parseStaticIds(rawIds: string): number[] {
    if (!rawIds) return [];
    
    const ids = rawIds
      .split(/[\s,;\n]+/)
      .map(id => id.trim())
      .filter(id => id)
      .map(Number)
      .filter(id => !isNaN(id) && Number.isInteger(id) && id > 0);
      
    // Убираем дубликаты
    return [...new Set(ids)];
  }
  
  private async fetchApiIds(apiInfo: ApiUserBase): Promise<number[]> {
    const cacheKey = `${apiInfo.apiUrl}-${apiInfo.apiMethod}`;
    const cached = apiCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        this.onProgress('loading', 'Loading user IDs from cache...');
        return cached.data;
    }
    
    try {
        const headers = new Headers();
        (apiInfo.apiHeaders || []).forEach(h => headers.append(h.key, h.value));

        const response = await fetch(apiInfo.apiUrl, {
            method: apiInfo.apiMethod || 'GET',
            headers,
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        
        // Ожидаем, что API вернет массив чисел или массив объектов с полем 'id'
        let rawIds: any[];
        if (Array.isArray(data)) {
            rawIds = data;
        } else if (data && typeof data === 'object' && Array.isArray(data.users)) { // Пример для { "users": [...] }
            rawIds = data.users;
        } else {
            throw new Error('Invalid API response format. Expected an array of IDs or objects with an "id" property.');
        }

        const userIds = rawIds
            .map(item => (typeof item === 'object' && item !== null && 'id' in item) ? item.id : item)
            .map(Number)
            .filter(id => !isNaN(id) && Number.isInteger(id) && id > 0);

        const uniqueIds = [...new Set(userIds)];
        apiCache.set(cacheKey, { data: uniqueIds, timestamp: Date.now() });
        
        return uniqueIds;

    } catch (error) {
        throw new Error(`API fetch error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 