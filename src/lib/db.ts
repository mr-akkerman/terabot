'use client'
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Campaign, UserBase, Bot, CampaignRecipient } from '@/types';

// 1. Определение схемы базы данных
interface TerabotDB extends DBSchema {
  campaigns: {
    key: string;
    value: Campaign;
    indexes: { createdAt: Date };
  };
  userBases: {
    key: string;
    value: UserBase;
    indexes: { name: string };
  };
  bots: {
    key: string;
    value: Bot;
    indexes: { name: string };
  };
  settings: {
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
  }
  campaignRecipients: {
    key: [string, number]; // [campaignId, userId]
    value: {
      campaignId: string;
      userId: number;
      status: 'pending' | 'success' | 'failed';
      error?: string;
      timestamp: Date;
    };
    indexes: { campaignId: string };
  };
}

const DB_NAME = 'terabot-db';
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<TerabotDB>> | null = null;

const initDB = () => {
    if (dbPromise) {
        return dbPromise;
    }
    
    dbPromise = openDB<TerabotDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('campaigns')) {
                const campaignStore = db.createObjectStore('campaigns', { keyPath: 'id' });
                campaignStore.createIndex('createdAt', 'createdAt');
            }
            if (!db.objectStoreNames.contains('userBases')) {
                const userBaseStore = db.createObjectStore('userBases', { keyPath: 'id' });
                userBaseStore.createIndex('name', 'name');
            }
            if (!db.objectStoreNames.contains('bots')) {
                const botStore = db.createObjectStore('bots', { keyPath: 'id' });
                botStore.createIndex('name', 'name');
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('campaignRecipients')) {
                const recipientStore = db.createObjectStore('campaignRecipients', { keyPath: ['campaignId', 'userId'] });
                recipientStore.createIndex('campaignId', 'campaignId');
            }
        },
    });

    return dbPromise;
};


// 3. CRUD операции для Campaign
export const campaignStore = {
  async getAll(): Promise<Campaign[]> {
    const db = await initDB();
    return db.getAll('campaigns');
  },
  async get(id: string): Promise<Campaign | undefined> {
    const db = await initDB();
    return db.get('campaigns', id);
  },
  async add(campaign: Campaign): Promise<string> {
    const db = await initDB();
    return db.add('campaigns', campaign);
  },
  async update(campaign: Campaign): Promise<string> {
    const db = await initDB();
    return db.put('campaigns', campaign);
  },
  async delete(id: string): Promise<void> {
    const db = await initDB();
    return db.delete('campaigns', id);
  },
};

// 4. CRUD операции для UserBase
export const userBaseStore = {
  async getAll(): Promise<UserBase[]> {
    const db = await initDB();
    return db.getAll('userBases');
  },
  async get(id: string): Promise<UserBase | undefined> {
    const db = await initDB();
    return db.get('userBases', id);
  },
  async add(userBase: UserBase): Promise<string> {
    const db = await initDB();
    return db.add('userBases', userBase);
  },
  async update(userBase: UserBase): Promise<string> {
    const db = await initDB();
    return db.put('userBases', userBase);
  },
  async delete(id: string): Promise<void> {
    const db = await initDB();
    return db.delete('userBases', id);
  },
};

// 5. CRUD операции для Bot
export const botStore = {
  async getAll(): Promise<Bot[]> {
    const db = await initDB();
    return db.getAll('bots');
  },
  async get(id: string): Promise<Bot | undefined> {
    const db = await initDB();
    return db.get('bots', id);
  },
  async add(bot: Bot): Promise<string> {
    const db = await initDB();
    return db.add('bots', bot);
  },
  async update(bot: Bot): Promise<string> {
    const db = await initDB();
    return db.put('bots', bot);
  },
  async delete(id: string): Promise<void> {
    const db = await initDB();
    return db.delete('bots', id);
  },
};

// 6. CRUD операции для Settings
export const settingsStore = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const db = await initDB();
    const result = await db.get('settings', key);
    return result?.value;
  },
  async set(key: string, value: unknown): Promise<string> {
    const db = await initDB();
    return db.put('settings', { key, value });
  }
}

// 7. CRUD операции для CampaignRecipients
export const campaignRecipientStore = {
    async bulkAdd(
        recipients: { campaignId: string; userId: number; status: 'pending' }[]
    ): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('campaignRecipients', 'readwrite');
        const itemsToAdd = recipients.map(r => ({ ...r, timestamp: new Date() }));
        await Promise.all(itemsToAdd.map(r => tx.store.put(r)));
        await tx.done;
    },

    async updateStatus(
        campaignId: string,
        userId: number,
        status: 'success' | 'failed',
        error?: string
    ): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('campaignRecipients', 'readwrite');
        const store = tx.store;
        const recipient = await store.get([campaignId, userId]);
        if (recipient) {
            recipient.status = status;
            if (error) recipient.error = error;
            recipient.timestamp = new Date();
            await store.put(recipient);
        }
        await tx.done;
    },

    // Переименовываем старый метод getUnprocessed в getAllRecipients для ясности
    async getAllRecipients(campaignId: string): Promise<{ userId: number; status: 'pending' | 'success' | 'failed'; }[]> {
        const db = await initDB();
        return db.getAllFromIndex(
            'campaignRecipients',
            'campaignId',
            IDBKeyRange.only(campaignId)
        );
    },

    // Новый метод для получения только ID обработанных пользователей (success или failed)
    async getProcessedUserIds(campaignId: string): Promise<number[]> {
        const db = await initDB();
        const allRecipients = await db.getAllFromIndex(
            'campaignRecipients',
            'campaignId',
            IDBKeyRange.only(campaignId)
        );
        return allRecipients
            .filter(r => r.status === 'success' || r.status === 'failed')
            .map(r => r.userId);
    },

    // Новый метод для получения только pending записей
    async getPendingRecipients(campaignId: string): Promise<{ userId: number; status: 'pending'; }[]> {
        const db = await initDB();
        const allRecipients = await db.getAllFromIndex(
            'campaignRecipients',
            'campaignId',
            IDBKeyRange.only(campaignId)
        );
        return allRecipients.filter(r => r.status === 'pending') as { userId: number; status: 'pending'; }[];
    },

    // Метод для получения статистики по кампании
    async getCampaignStats(campaignId: string): Promise<{ total: number; success: number; failed: number; pending: number }> {
        const db = await initDB();
        const allRecipients = await db.getAllFromIndex(
            'campaignRecipients',
            'campaignId',
            IDBKeyRange.only(campaignId)
        );
        
        const stats = {
            total: allRecipients.length,
            success: 0,
            failed: 0,
            pending: 0
        };

        allRecipients.forEach(r => {
            if (r.status === 'success') stats.success++;
            else if (r.status === 'failed') stats.failed++;
            else if (r.status === 'pending') stats.pending++;
        });

        return stats;
    },
    
    async getByCampaignId(campaignId: string): Promise<CampaignRecipient[]> {
        const db = await initDB();
        return db.getAllFromIndex(
            'campaignRecipients',
            'campaignId',
            IDBKeyRange.only(campaignId)
        );
    },

    async clearForCampaign(campaignId: string): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('campaignRecipients', 'readwrite');
        const index = tx.store.index('campaignId');
        let cursor = await index.openCursor(IDBKeyRange.only(campaignId));
        while(cursor) {
            cursor.delete();
            cursor = await cursor.continue();
        }
        await tx.done;
    }
}; 