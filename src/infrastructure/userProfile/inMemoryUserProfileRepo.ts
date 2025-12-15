import { randomUUID } from 'node:crypto';
import type { UserProfileRepo } from '@/application/ports/userProfile/UserProfileRepo.js';
import type { UserProfile, UserProfilePatchInput, UserProfileUpsertInput } from '@/domain/userProfile.js';

export function createInMemoryUserProfileRepo(): UserProfileRepo {
  const byUserId = new Map<string, UserProfile>();

  return {
    async findByUserId(userId) {
      return byUserId.get(userId) ?? null;
    },

    async upsertByUserId(userId, input) {
      const existing = byUserId.get(userId);
      if (existing) {
        const updated: UserProfile = {
          ...existing,
          ...input,
          updatedAt: new Date()
        };
        byUserId.set(userId, updated);
        return { profile: updated, created: false };
      }

      const now = new Date();
      const createdProfile: UserProfile = {
        id: randomUUID(),
        userId,
        createdAt: now,
        updatedAt: now,
        ...input
      };
      byUserId.set(userId, createdProfile);
      return { profile: createdProfile, created: true };
    },

    async patchByUserId(userId, patch) {
      const existing = byUserId.get(userId);
      if (!existing) return null;
      const updated: UserProfile = {
        ...existing,
        ...patch,
        updatedAt: new Date()
      };
      byUserId.set(userId, updated);
      return updated;
    },

    async deleteByUserId(userId) {
      return byUserId.delete(userId);
    }
  };
}
