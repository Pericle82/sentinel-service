import type { PermissionRepository } from '@/application/ports/rbac/PermissionRepository.js';
import type { PermissionName, RoleName } from '@/domain/security/types.js';

export function createInMemoryPermissionRepository(map: Record<RoleName, PermissionName[]> = {}): PermissionRepository {
  return {
    async getPermissionsForRoles(roles: RoleName[]) {
      const perms = new Set<PermissionName>();
      for (const role of roles) {
        for (const p of map[role] ?? []) perms.add(p);
      }
      return perms;
    }
  };
}
