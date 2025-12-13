import type { PermissionName, Principal } from '@/domain/security/types.js';
import type { PermissionRepository } from '@/application/ports/rbac/PermissionRepository.js';

export type AuthorizationService = {
  hasPermission(principal: Principal, permission: PermissionName): Promise<boolean>;
};

export function createAuthorizationService(permissionRepo: PermissionRepository): AuthorizationService {
  return {
    async hasPermission(principal, permission) {
      const perms = await permissionRepo.getPermissionsForRoles(principal.roles);
      return perms.has(permission);
    }
  };
}
