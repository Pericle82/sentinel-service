import { describe, expect, it } from 'vitest';

import { createInMemoryUserRepo } from '@/infrastructure/user/inMemoryUserRepo.js';
import type { UserIdentityLink } from '@/domain/user.js';

describe('createInMemoryUserRepo', () => {
  const link: UserIdentityLink = {
    provider: 'oidc',
    externalId: 'sub-123',
    email: 'user@example.com',
    name: 'Test User'
  };

  it('creates a user from an external identity and reuses it', async () => {
    const repo = createInMemoryUserRepo();

    const first = await repo.findOrCreateByExternalIdentity(link);
    expect(first.id).toBeTruthy();
    expect(first.username).toBe('sub-123');
    expect(first.primaryEmail).toBe('user@example.com');
    expect(first.name).toBe('Test User');

    const again = await repo.findOrCreateByExternalIdentity(link);
    expect(again.id).toBe(first.id);
    expect(again.primaryEmail).toBe('user@example.com');
  });

  it('falls back to externalId as username when none provided', async () => {
    const repo = createInMemoryUserRepo();

    const user = await repo.findOrCreateByExternalIdentity({ provider: 'oidc', externalId: 'sub-999' });
    expect(user.username).toBe('sub-999');
  });
});
