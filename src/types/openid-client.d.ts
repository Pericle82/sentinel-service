declare module 'openid-client' {
  export const generators: {
    state(): string;
    nonce(): string;
    codeVerifier(): string;
    codeChallenge(verifier: string): string;
  };

  export interface ClientMetadata {
    client_id: string;
    client_secret?: string;
    redirect_uris?: string[];
    response_types?: string[];
  }

  export interface TokenSet {
    id_token?: string;
    access_token?: string;
    claims(): Record<string, unknown>;
  }

  export class Client {
    constructor(metadata: ClientMetadata);
    authorizationUrl(params: Record<string, unknown>): string;
    callback(redirectUri: string, params: Record<string, unknown>, checks: Record<string, unknown>): Promise<TokenSet>;
    issuer: Issuer;
  }

  export class Issuer {
    static discover(url: string): Promise<Issuer>;
    constructor(metadata: Record<string, unknown>);
    Client: typeof Client;
    metadata: Record<string, unknown>;
  }

  const openid: {
    generators: typeof generators;
    Issuer: typeof Issuer;
  };

  export default openid;
}
