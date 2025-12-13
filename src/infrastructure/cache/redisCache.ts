import { Redis } from 'ioredis';
import type { Cache } from '@/application/ports/cache/Cache.js';

export type CacheAdapter = {
  cache: Cache;
  close(): Promise<void>;
};

export function createRedisCache(options: { url: string }): CacheAdapter {
  const client = new Redis(options.url);

  const cache: Cache = {
    async get(key) {
      return await client.get(key);
    },
    async set(key, value, ttlSeconds) {
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, value, 'EX', ttlSeconds);
        return;
      }
      await client.set(key, value);
    },
    async del(key) {
      await client.del(key);
    }
  };

  return {
    cache,
    async close() {
      await client.quit();
    }
  };
}
