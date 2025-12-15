import { DomainError } from '@/domain/errors.js';
import type { Principal } from '@/domain/security/types.js';
import type { UserIdentityLink } from '@/domain/user.js';
import type {
  UserProfile,
  UserProfilePatchInput,
  UserProfileUpsertInput
} from '@/domain/userProfile.js';
import type { UserRepo } from '@/application/ports/user/UserRepo.js';
import type { UserProfileRepo } from '@/application/ports/userProfile/UserProfileRepo.js';

export type ResolveUserId = {
  resolve(principal: Principal): Promise<string>;
};

export function createResolveUserId(deps: { userRepo: UserRepo; provider?: string }): ResolveUserId {
  const provider = deps.provider ?? 'oidc';

  return {
    async resolve(principal) {
      const link: UserIdentityLink = {
        provider,
        externalId: principal.sub,
        ...(principal.email ? { email: principal.email } : {}),
        ...(principal.name ? { name: principal.name } : {}),
        username: principal.email ?? principal.sub
      };
      const user = await deps.userRepo.findOrCreateByExternalIdentity(link);
      return user.id;
    }
  };
}

export type GetUserProfile = {
  execute(principal: Principal): Promise<UserProfile>;
};

export function createGetUserProfile(deps: { resolveUserId: ResolveUserId; profileRepo: UserProfileRepo }): GetUserProfile {
  return {
    async execute(principal) {
      const userId = await deps.resolveUserId.resolve(principal);
      const profile = await deps.profileRepo.findByUserId(userId);
      if (!profile) throw new DomainError('NOT_FOUND', 'Profile not found');
      return profile;
    }
  };
}

export type UpsertUserProfile = {
  execute(principal: Principal, input: UserProfileUpsertInput): Promise<{ profile: UserProfile; created: boolean }>;
};

export function createUpsertUserProfile(deps: { resolveUserId: ResolveUserId; profileRepo: UserProfileRepo }): UpsertUserProfile {
  return {
    async execute(principal, input) {
      validateCore(input);
      const userId = await deps.resolveUserId.resolve(principal);
      return await deps.profileRepo.upsertByUserId(userId, input);
    }
  };
}

export type PatchUserProfile = {
  execute(principal: Principal, patch: UserProfilePatchInput): Promise<UserProfile>;
};

export function createPatchUserProfile(deps: { resolveUserId: ResolveUserId; profileRepo: UserProfileRepo }): PatchUserProfile {
  return {
    async execute(principal, patch) {
      if (!patch || Object.keys(patch).length === 0) {
        throw new DomainError('DOMAIN_RULE_VIOLATION', 'No data provided for update');
      }
      validatePatch(patch);
      const userId = await deps.resolveUserId.resolve(principal);
      const profile = await deps.profileRepo.patchByUserId(userId, patch);
      if (!profile) throw new DomainError('NOT_FOUND', 'Profile not found');
      return profile;
    }
  };
}

export type DeleteUserProfile = {
  execute(principal: Principal): Promise<void>;
};

export function createDeleteUserProfile(deps: { resolveUserId: ResolveUserId; profileRepo: UserProfileRepo }): DeleteUserProfile {
  return {
    async execute(principal) {
      const userId = await deps.resolveUserId.resolve(principal);
      const deleted = await deps.profileRepo.deleteByUserId(userId);
      if (!deleted) throw new DomainError('NOT_FOUND', 'Profile not found');
    }
  };
}

export type CalculateUserBmi = {
  execute(principal: Principal): Promise<{ bmi: number; category: string }>;
};

export function createCalculateUserBmi(deps: { resolveUserId: ResolveUserId; profileRepo: UserProfileRepo }): CalculateUserBmi {
  return {
    async execute(principal) {
      const userId = await deps.resolveUserId.resolve(principal);
      const profile = await deps.profileRepo.findByUserId(userId);
      if (!profile) throw new DomainError('NOT_FOUND', 'Profile not found');

      const heightM = profile.height / 100;
      const bmi = profile.weight / (heightM * heightM);
      const rounded = Math.round(bmi * 100) / 100;
      const category = bmiCategory(rounded);

      return { bmi: rounded, category };
    }
  };
}

export type GetProfileCompletion = {
  execute(principal: Principal): Promise<{ completionScore: number; missingFields: string[] }>;
};

export function createGetProfileCompletion(deps: { resolveUserId: ResolveUserId; profileRepo: UserProfileRepo }): GetProfileCompletion {
  return {
    async execute(principal) {
      const userId = await deps.resolveUserId.resolve(principal);
      const profile = await deps.profileRepo.findByUserId(userId);
      if (!profile) throw new DomainError('NOT_FOUND', 'Profile not found');

      const missing: string[] = [];
      if (!profile.height) missing.push('height');
      if (!profile.weight) missing.push('weight');
      if (!profile.age) missing.push('age');
      if (!profile.workLifestyle?.jobType) missing.push('workLifestyle.jobType');
      if (!profile.sleepPatterns?.avgBedtime || !profile.sleepPatterns?.avgWakeTime) missing.push('sleepPatterns');

      const score = Math.max(0, 100 - missing.length * 15);
      return { completionScore: score, missingFields: missing };
    }
  };
}

function validateCore(input: UserProfileUpsertInput) {
  if (input.height <= 0 || input.weight <= 0 || input.age <= 0) {
    throw new DomainError('DOMAIN_RULE_VIOLATION', 'height, weight, age must be positive');
  }
  if (input.height < 50 || input.height > 300) {
    throw new DomainError('DOMAIN_RULE_VIOLATION', 'height must be between 50 and 300 cm');
  }
  if (input.weight < 20 || input.weight > 500) {
    throw new DomainError('DOMAIN_RULE_VIOLATION', 'weight must be between 20 and 500 kg');
  }
  if (input.age < 13 || input.age > 120) {
    throw new DomainError('DOMAIN_RULE_VIOLATION', 'age must be between 13 and 120');
  }
}

function validatePatch(patch: UserProfilePatchInput) {
  if (patch.height !== undefined && (patch.height <= 0 || patch.height < 50 || patch.height > 300)) {
    throw new DomainError('DOMAIN_RULE_VIOLATION', 'height must be between 50 and 300 cm');
  }
  if (patch.weight !== undefined && (patch.weight <= 0 || patch.weight < 20 || patch.weight > 500)) {
    throw new DomainError('DOMAIN_RULE_VIOLATION', 'weight must be between 20 and 500 kg');
  }
  if (patch.age !== undefined && (patch.age <= 0 || patch.age < 13 || patch.age > 120)) {
    throw new DomainError('DOMAIN_RULE_VIOLATION', 'age must be between 13 and 120');
  }
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}
