import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/errors.js';
import { createInMemoryUserRepo } from '@/infrastructure/user/inMemoryUserRepo.js';
import { createInMemoryUserProfileRepo } from '@/infrastructure/userProfile/inMemoryUserProfileRepo.js';
import {
  createResolveUserId,
  createUpsertUserProfile,
  createPatchUserProfile,
  createCalculateUserBmi,
  createGetProfileCompletion
} from '@/application/usecases/userProfile.js';
import type { Principal } from '@/domain/security/types.js';

const principal: Principal = { sub: 'user-1', roles: [] };

function buildDeps() {
  const userRepo = createInMemoryUserRepo();
  const profileRepo = createInMemoryUserProfileRepo();
  const resolveUserId = createResolveUserId({ userRepo });

  return {
    profileRepo,
    resolveUserId,
    upsert: createUpsertUserProfile({ resolveUserId, profileRepo }),
    patch: createPatchUserProfile({ resolveUserId, profileRepo }),
    bmi: createCalculateUserBmi({ resolveUserId, profileRepo }),
    completion: createGetProfileCompletion({ resolveUserId, profileRepo })
  };
}

describe('user profile usecases edge cases', () => {
  it('rejects invalid height/weight/age on upsert', async () => {
    const { upsert } = buildDeps();

    await expect(upsert.execute(principal, { height: 10, weight: 50, age: 20 }))
      .rejects.toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' as DomainError['code'] });

    await expect(upsert.execute(principal, { height: 170, weight: 10, age: 20 }))
      .rejects.toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' as DomainError['code'] });

    await expect(upsert.execute(principal, { height: 170, weight: 70, age: 5 }))
      .rejects.toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' as DomainError['code'] });
  });

  it('rejects invalid patch payloads', async () => {
    const { upsert, patch } = buildDeps();
    await upsert.execute(principal, { height: 180, weight: 80, age: 30 });

    await expect(patch.execute(principal, {} as never))
      .rejects.toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' as DomainError['code'] });

    await expect(patch.execute(principal, { weight: -5 }))
      .rejects.toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' as DomainError['code'] });
  });

  it('returns NOT_FOUND when profile missing for BMI/completion/patch', async () => {
    const { patch, bmi, completion } = buildDeps();

    await expect(bmi.execute(principal))
      .rejects.toMatchObject({ code: 'NOT_FOUND' as DomainError['code'] });

    await expect(completion.execute(principal))
      .rejects.toMatchObject({ code: 'NOT_FOUND' as DomainError['code'] });

    await expect(patch.execute(principal, { weight: 70 }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' as DomainError['code'] });
  });
});
