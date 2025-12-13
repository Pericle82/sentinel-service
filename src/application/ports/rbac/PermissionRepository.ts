import type { PermissionName, RoleName } from '@/domain/security/types.js';

export interface PermissionRepository {
  getPermissionsForRoles(roles: RoleName[]): Promise<Set<PermissionName>>;
}
