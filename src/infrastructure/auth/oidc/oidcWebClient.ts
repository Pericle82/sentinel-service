import * as openid from 'openid-client';
import type { Client, ClientMetadata, TokenSet } from 'openid-client';
import { principalFromClaims } from './oidcTokenVerifier.js';
import type { AppConfig } from '@/infrastructure/config/env.js';
import type { Principal } from '@/domain/security/types.js';

export type OidcLoginArtifacts = {
  state: string;
  nonce: string;
  codeVerifier: string;
};

export type OidcSession = {
  principal: Principal;
  tokenExpiresAt: number;
  idToken?: string;
  accessToken?: string;
};

const { Issuer, generators } = openid;

let cachedClient: Client | null = null;
let cachedIssuer: string | null = null;

async function getClient(config: AppConfig): Promise<Client> {
  if (!config.auth.oidc.issuer || !config.auth.oidc.clientId) {
    throw new Error('OIDC issuer/client not configured');
  }

  if (cachedClient && cachedIssuer === config.auth.oidc.issuer) return cachedClient;

  const issuer = await Issuer.discover(config.auth.oidc.issuer);
  const clientMetadata: ClientMetadata = {
    client_id: config.auth.oidc.clientId,
    ...(config.auth.oidc.clientSecret ? { client_secret: config.auth.oidc.clientSecret } : {}),
    ...(config.auth.oidc.redirectUri ? { redirect_uris: [config.auth.oidc.redirectUri] } : {}),
    response_types: ['code']
  };
  cachedClient = new issuer.Client(clientMetadata);
  cachedIssuer = config.auth.oidc.issuer;
  return cachedClient;
}

export async function buildAuthorizationUrl(config: AppConfig): Promise<{ url: string; artifacts: OidcLoginArtifacts }> {
  const client = await getClient(config);
  if (!config.auth.oidc.redirectUri) throw new Error('OIDC_REDIRECT_URI is required');

  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  const url = client.authorizationUrl({
    scope: config.auth.oidc.scopes ?? 'openid profile email',
    redirect_uri: config.auth.oidc.redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce
  });

  return { url, artifacts: { state, nonce, codeVerifier } };
}

export async function handleCallback(
  config: AppConfig,
  params: { state?: string; code?: string },
  artifacts: OidcLoginArtifacts
): Promise<OidcSession> {
  const client = await getClient(config);
  if (!config.auth.oidc.redirectUri) throw new Error('OIDC_REDIRECT_URI is required');
  if (!params.state || !params.code) throw new Error('Missing state or code');
  if (params.state !== artifacts.state) throw new Error('State mismatch');

  const tokenSet: TokenSet = await client.callback(
    config.auth.oidc.redirectUri,
    { code: params.code, state: params.state },
    {
      code_verifier: artifacts.codeVerifier,
      nonce: artifacts.nonce
    }
  );

  const claims = tokenSet.claims();
  const principal = principalFromClaims(claims as Record<string, unknown>);
  const exp = typeof claims['exp'] === 'number' ? claims['exp'] : undefined;
  const nowSec = Math.floor(Date.now() / 1000);
  const ttlSec = config.session.ttlSeconds;
  const sessionExpiry = Math.min(exp ?? nowSec + ttlSec, nowSec + ttlSec);

  return {
    principal,
    tokenExpiresAt: sessionExpiry * 1000,
    ...(tokenSet.id_token ? { idToken: tokenSet.id_token } : {}),
    ...(tokenSet.access_token ? { accessToken: tokenSet.access_token } : {})
  };
}

export async function buildLogoutUrl(config: AppConfig, idTokenHint?: string): Promise<string | null> {
  const client = await getClient(config);
  const endSessionEndpoint = client.issuer.metadata['end_session_endpoint'] as string | undefined;
  if (!endSessionEndpoint) return null;

  const url = new URL(endSessionEndpoint);
  if (idTokenHint) url.searchParams.set('id_token_hint', idTokenHint);
  if (config.auth.oidc.postLogoutRedirectUri) {
    url.searchParams.set('post_logout_redirect_uri', config.auth.oidc.postLogoutRedirectUri);
  }
  return url.toString();
}
