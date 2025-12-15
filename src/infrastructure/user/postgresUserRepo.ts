import type { Database } from '@/application/ports/db/Database.js';
import type { UserRepo } from '@/application/ports/user/UserRepo.js';
import type { UserIdentityLink, UserRecord } from '@/domain/user.js';

function mapRow(row: Record<string, unknown>): UserRecord {
  const record: UserRecord = {
    id: row['id'] as string
  };

  const primaryEmail = row['primaryEmail'] as string | null | undefined;
  if (primaryEmail != null) {
    record.primaryEmail = primaryEmail;
  }

  const name = row['name'] as string | null | undefined;
  if (name != null) {
    record.name = name;
  }

  const username = row['username'] as string | null | undefined;
  if (username != null) {
    record.username = username;
  }

  return record;
}

export function createPostgresUserRepo(db: Database): UserRepo {
  return {
    async findByExternalIdentity(link: UserIdentityLink): Promise<UserRecord | null> {
      const res = await db.query<{
        id: string;
        primaryEmail: string | null;
        name: string | null;
        username: string | null;
      }>(
        `SELECT u.id,
                u.primary_email AS "primaryEmail",
                u.name,
                u.username
         FROM users u
         INNER JOIN user_identities i ON i.user_id = u.id
         WHERE i.provider = $1 AND i.external_id = $2
         LIMIT 1`,
        [link.provider, link.externalId]
      );

      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      if (!row) return null;
      return mapRow(row);
    },

    async findOrCreateByExternalIdentity(link: UserIdentityLink): Promise<UserRecord> {
      const existing = await this.findByExternalIdentity(link);
      if (existing) return existing;

      const userRes = await db.query<{
        id: string;
        primaryEmail: string | null;
        name: string | null;
        username: string | null;
      }>(
        `INSERT INTO users (primary_email, name, username)
         VALUES ($1, $2, $3)
         RETURNING id, primary_email AS "primaryEmail", name, username`,
        [link.email ?? null, link.name ?? null, link.username ?? link.externalId]
      );

      const userRow = userRes.rows[0];
      if (!userRow) {
        throw new Error('Failed to insert user');
      }

      const user = mapRow(userRow);

      await db.query(
        `INSERT INTO user_identities (user_id, provider, external_id, email, name, username)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (provider, external_id)
         DO UPDATE SET user_id = EXCLUDED.user_id,
                       email = EXCLUDED.email,
                       name = EXCLUDED.name,
                       username = EXCLUDED.username`,
        [user.id, link.provider, link.externalId, link.email ?? null, link.name ?? null, link.username ?? link.externalId]
      );

      return user;
    }
  };
}
