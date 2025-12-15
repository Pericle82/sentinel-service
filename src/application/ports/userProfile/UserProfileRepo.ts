import type { UserProfile, UserProfilePatchInput, UserProfileUpsertInput } from '@/domain/userProfile.js';

export interface UserProfileRepo {
  findByUserId(userId: string): Promise<UserProfile | null>;
  upsertByUserId(userId: string, input: UserProfileUpsertInput): Promise<{ profile: UserProfile; created: boolean }>;
  patchByUserId(userId: string, patch: UserProfilePatchInput): Promise<UserProfile | null>;
  deleteByUserId(userId: string): Promise<boolean>;
}
