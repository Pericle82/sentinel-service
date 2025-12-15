import { randomUUID } from 'node:crypto';
import type { UserRepo } from '@/application/ports/user/UserRepo.js';
import type { UserIdentityLink, UserRecord } from '@/domain/user.js';

export function createInMemoryUserRepo(): UserRepo {
  const byExternal = new Map<string, UserRecord>();

  function key(link: UserIdentityLink) {
    return `${link.provider}:${link.externalId}`;
  }

  return {
    async findByExternalIdentity(link) {
      return byExternal.get(key(link)) ?? null;
    },

    async findOrCreateByExternalIdentity(link) {
      const k = key(link);
      const existing = byExternal.get(k);
      if (existing) return existing;

      const record: UserRecord = {
        id: randomUUID(),
        ...(link.email ? { primaryEmail: link.email } : {}),
        ...(link.name ? { name: link.name } : {}),
        username: link.username ?? link.externalId
      };
      byExternal.set(k, record);
      return record;
    }
  };
}
