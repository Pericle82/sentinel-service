import type { Principal } from '@/domain/security/types.js';

declare module 'fastify' {
  interface SessionData {
    auth?: {
      principal?: Principal;
      tokenExpiresAt?: number;
      idToken?: string;
    };
    oidc_login?: {
      state: string;
      nonce: string;
      codeVerifier: string;
      createdAt: number;
    };
  }

  interface FastifyRequest {
    principal?: Principal;
    rawClaims?: Record<string, unknown>;
  }
}

export {};
