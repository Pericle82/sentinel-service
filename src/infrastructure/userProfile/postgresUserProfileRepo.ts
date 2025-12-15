import type { Database } from '@/application/ports/db/Database.js';
import type { UserProfileRepo } from '@/application/ports/userProfile/UserProfileRepo.js';
import type { UserProfile, UserProfilePatchInput, UserProfileUpsertInput } from '@/domain/userProfile.js';

function mapRow(row: Record<string, unknown>): UserProfile {
  const genderRaw = row['gender'] as string | null | undefined;
  const fitnessLevelRaw = row['fitnessLevel'] as string | null | undefined;

  const gender: UserProfile['gender'] =
    genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'other' ? genderRaw : undefined;

  const fitnessLevel: UserProfile['fitnessLevel'] =
    fitnessLevelRaw === 'beginner' || fitnessLevelRaw === 'intermediate' || fitnessLevelRaw === 'advanced'
      ? fitnessLevelRaw
      : undefined;
  const workLifestyle = (row['workLifestyle'] as UserProfile['workLifestyle'] | null | undefined) ?? undefined;
  const sleepPatterns = (row['sleepPatterns'] as UserProfile['sleepPatterns'] | null | undefined) ?? undefined;

  const profile: UserProfile = {
    id: row['id'] as string,
    userId: row['userId'] as string,
    height: Number(row['height']),
    weight: Number(row['weight']),
    age: Number(row['age']),
    createdAt: new Date(row['createdAt'] as string),
    updatedAt: new Date(row['updatedAt'] as string)
  };

  if (gender !== undefined) profile.gender = gender;
  if (fitnessLevel !== undefined) profile.fitnessLevel = fitnessLevel;
  if (workLifestyle !== undefined) profile.workLifestyle = workLifestyle;
  if (sleepPatterns !== undefined) profile.sleepPatterns = sleepPatterns;

  const goalsValue = row['goals'];
  if (goalsValue !== undefined) profile.goals = goalsValue as string | null;

  const medicalNotesValue = row['medicalNotes'];
  if (medicalNotesValue !== undefined) profile.medicalNotes = medicalNotesValue as string | null;

  return profile;
}

export function createPostgresUserProfileRepo(db: Database): UserProfileRepo {
  return {
    async findByUserId(userId) {
      const res = await db.query<{
        id: string;
        userId: string;
        height: number;
        weight: number;
        age: number;
        gender: string | null;
        fitnessLevel: string | null;
        goals: string | null;
        medicalNotes: string | null;
        workLifestyle: unknown;
        sleepPatterns: unknown;
        createdAt: string;
        updatedAt: string;
      }>(
        `SELECT id,
                user_id AS "userId",
                height,
                weight,
                age,
                gender,
                fitness_level AS "fitnessLevel",
                goals,
                medical_notes AS "medicalNotes",
                work_lifestyle AS "workLifestyle",
                sleep_patterns AS "sleepPatterns",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
         FROM user_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      if (!row) return null;
      return mapRow(row as Record<string, unknown>);
    },

    async upsertByUserId(userId, input) {
      const res = await db.query<{
        id: string;
        userId: string;
        height: number;
        weight: number;
        age: number;
        gender: string | null;
        fitnessLevel: string | null;
        goals: string | null;
        medicalNotes: string | null;
        workLifestyle: unknown;
        sleepPatterns: unknown;
        createdAt: string;
        updatedAt: string;
        inserted: boolean;
      }>(
        `INSERT INTO user_profiles (
           user_id,
           height,
           weight,
           age,
           gender,
           fitness_level,
           goals,
           medical_notes,
           work_lifestyle,
           sleep_patterns
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id) DO UPDATE SET
           height = EXCLUDED.height,
           weight = EXCLUDED.weight,
           age = EXCLUDED.age,
           gender = EXCLUDED.gender,
           fitness_level = EXCLUDED.fitness_level,
           goals = EXCLUDED.goals,
           medical_notes = EXCLUDED.medical_notes,
           work_lifestyle = EXCLUDED.work_lifestyle,
           sleep_patterns = EXCLUDED.sleep_patterns,
           updated_at = NOW()
         RETURNING id,
                   user_id AS "userId",
                   height,
                   weight,
                   age,
                   gender,
                   fitness_level AS "fitnessLevel",
                   goals,
                   medical_notes AS "medicalNotes",
                   work_lifestyle AS "workLifestyle",
                   sleep_patterns AS "sleepPatterns",
                   created_at AS "createdAt",
                   updated_at AS "updatedAt",
                   (xmax = 0) AS inserted`,
        [
          userId,
          input.height,
          input.weight,
          input.age,
          input.gender ?? null,
          input.fitnessLevel ?? null,
          input.goals ?? null,
          input.medicalNotes ?? null,
          input.workLifestyle ?? null,
          input.sleepPatterns ?? null
        ]
      );

      const row = res.rows[0];
      if (!row) throw new Error('Failed to upsert user profile');
      const created = !!row.inserted;
      return { profile: mapRow(row as Record<string, unknown>), created };
    },

    async patchByUserId(userId, patch) {
      if (!patch || Object.keys(patch).length === 0) return await this.findByUserId(userId);

      const fields: string[] = [];
      const values: unknown[] = [userId];
      let idx = 2;

      const setField = (column: string, value: unknown) => {
        fields.push(`${column} = $${idx}`);
        values.push(value);
        idx += 1;
      };

      if (patch.height !== undefined) setField('height', patch.height);
      if (patch.weight !== undefined) setField('weight', patch.weight);
      if (patch.age !== undefined) setField('age', patch.age);
      if (patch.gender !== undefined) setField('gender', patch.gender ?? null);
      if (patch.fitnessLevel !== undefined) setField('fitness_level', patch.fitnessLevel ?? null);
      if (patch.goals !== undefined) setField('goals', patch.goals ?? null);
      if (patch.medicalNotes !== undefined) setField('medical_notes', patch.medicalNotes ?? null);
      if (patch.workLifestyle !== undefined) setField('work_lifestyle', patch.workLifestyle ?? null);
      if (patch.sleepPatterns !== undefined) setField('sleep_patterns', patch.sleepPatterns ?? null);

      fields.push(`updated_at = NOW()`);

      const res = await db.query<{
        id: string;
        userId: string;
        height: number;
        weight: number;
        age: number;
        gender: string | null;
        fitnessLevel: string | null;
        goals: string | null;
        medicalNotes: string | null;
        workLifestyle: unknown;
        sleepPatterns: unknown;
        createdAt: string;
        updatedAt: string;
      }>(
        `UPDATE user_profiles
         SET ${fields.join(', ')}
         WHERE user_id = $1
         RETURNING id,
                   user_id AS "userId",
                   height,
                   weight,
                   age,
                   gender,
                   fitness_level AS "fitnessLevel",
                   goals,
                   medical_notes AS "medicalNotes",
                   work_lifestyle AS "workLifestyle",
                   sleep_patterns AS "sleepPatterns",
                   created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        values
      );

      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      if (!row) return null;
      return mapRow(row as Record<string, unknown>);
    },

    async deleteByUserId(userId) {
      const res = await db.query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
      return res.rows !== undefined ? (res as unknown as { rowCount: number }).rowCount > 0 : true;
    }
  };
}
