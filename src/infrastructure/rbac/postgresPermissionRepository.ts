import type { PermissionRepository } from '@/application/ports/rbac/PermissionRepository.js';
import type { Database } from '@/application/ports/db/Database.js';
import type { PermissionName, RoleName } from '@/domain/security/types.js';

export function createPostgresPermissionRepository(db: Database): PermissionRepository {
  return {
    async getPermissionsForRoles(roles: RoleName[]) {
      if (roles.length === 0) return new Set<PermissionName>();
      const res = await db.query<{ permission_name: string }>(
        'SELECT permission_name FROM permissions WHERE is_active = true AND role = ANY($1::text[])',
        [roles]
      );
      return new Set(res.rows.map((r) => r.permission_name as PermissionName));
    }
  };
}
