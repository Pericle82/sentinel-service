import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { TokenVerifier, VerifyTokenResult } from '@/application/ports/auth/TokenVerifier.js';
import type { Principal, RoleName } from '@/domain/security/types.js';

export type OidcVerifierConfig = {
  issuer: string;
  audience?: string;
  jwksUri?: string;
};

type OidcDiscovery = { jwks_uri: string; issuer: string };

async function discover(issuer: string): Promise<OidcDiscovery> {
  const url = issuer.replace(/\/+$/, '') + '/.well-known/openid-configuration';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OIDC discovery failed (${res.status})`);
  const json = (await res.json()) as Partial<OidcDiscovery>;
  if (!json.jwks_uri || !json.issuer) throw new Error('OIDC discovery returned incomplete configuration');
  return { jwks_uri: json.jwks_uri, issuer: json.issuer };
}

function rolesFromClaims(claims: Record<string, unknown>): RoleName[] {
  const roles = new Set<string>();

  const realmAccess = claims['realm_access'];
  if (realmAccess && typeof realmAccess === 'object') {
    const raRoles = (realmAccess as { roles?: unknown }).roles;
    if (Array.isArray(raRoles)) {
      for (const r of raRoles) if (typeof r === 'string') roles.add(r);
    }
  }

  const groups = claims['groups'];
  if (Array.isArray(groups)) {
    for (const g of groups) if (typeof g === 'string') roles.add(g);
  }

  return [...roles];
}

export function principalFromClaims(claims: Record<string, unknown>): Principal {
  const sub = typeof claims['sub'] === 'string' ? claims['sub'] : 'unknown';
  const email = typeof claims['email'] === 'string' ? claims['email'] : undefined;
  const name = typeof claims['name'] === 'string' ? claims['name'] : undefined;
  const roles = rolesFromClaims(claims);

  return {
    sub,
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    roles
  };
}

export async function createOidcTokenVerifier(config: OidcVerifierConfig): Promise<TokenVerifier> {
  const discovery = config.jwksUri ? { jwks_uri: config.jwksUri, issuer: config.issuer } : await discover(config.issuer);
  const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));

  return {
    async verifyAccessToken(token: string): Promise<VerifyTokenResult> {
      const verified = await jwtVerify(token, jwks, {
        issuer: config.issuer,
        ...(config.audience ? { audience: config.audience } : {})
      });

      const claims = verified.payload as unknown as Record<string, unknown>;
      return {
        principal: principalFromClaims(claims),
        rawClaims: claims
      };
    }
  };
}

export function keycloakIssuer(baseUrl: string, realm: string) {
  return baseUrl.replace(/\/+$/, '') + '/realms/' + realm;
}
