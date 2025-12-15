import type { UserRecord, UserIdentityLink } from '@/domain/user.js';

export interface UserRepo {
  findByExternalIdentity(link: UserIdentityLink): Promise<UserRecord | null>;
  findOrCreateByExternalIdentity(link: UserIdentityLink): Promise<UserRecord>;
}
