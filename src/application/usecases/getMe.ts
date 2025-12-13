import type { Principal } from '@/domain/security/types.js';

export type MeDto = {
  authenticated: boolean;
  user?: {
    sub: string;
    email?: string;
    name?: string;
    roles: string[];
  };
};

export type GetMe = {
  execute(principal: Principal): Promise<MeDto>;
};

export function createGetMe(): GetMe {
  return {
    async execute(principal) {
      return {
        authenticated: true,
        user: {
          sub: principal.sub,
          ...(principal.email ? { email: principal.email } : {}),
          ...(principal.name ? { name: principal.name } : {}),
          roles: principal.roles
        }
      };
    }
  };
}
