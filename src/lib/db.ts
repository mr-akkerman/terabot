'use client'
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Campaign, UserBase, Bot } from '@/types';

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
    value: any;
  }
}

const DB_NAME = 'terabot-db';
const DB_VERSION = 3;

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
  async get(key: string): Promise<any> {
    const db = await initDB();
    const result = await db.get('settings', key);
    return result?.value;
  },
  async set(key: string, value: any): Promise<string> {
    const db = await initDB();
    return db.put('settings', { key, value });
  }
} 