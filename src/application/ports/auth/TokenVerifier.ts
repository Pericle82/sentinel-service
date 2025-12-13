import type { Principal } from '@/domain/security/types.js';

export type VerifyTokenResult = {
  principal: Principal;
  rawClaims: Record<string, unknown>;
};

export interface TokenVerifier {
  verifyAccessToken(token: string): Promise<VerifyTokenResult>;
}
