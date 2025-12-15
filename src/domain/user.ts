export type IdentityProvider = string;

export type UserRecord = {
  id: string; // app-level stable user id (UUID or similar)
  primaryEmail?: string;
  name?: string;
  username?: string;
};

export type UserIdentityLink = {
  provider: IdentityProvider;
  externalId: string; // e.g., OIDC sub
  email?: string;
  name?: string;
  username?: string;
};
