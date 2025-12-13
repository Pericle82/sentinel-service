export type UserId = string;
export type RoleName = string;
export type PermissionName = string;

export type Principal = {
  sub: string;
  email?: string;
  name?: string;
  roles: RoleName[];
};
