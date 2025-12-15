export type WorkLifestyle = {
  jobType?: string;
  workSchedule?: Record<string, { start?: string; end?: string; lunchBreak?: boolean }>;
  workFromHome?: boolean;
  commuteMinutes?: number;
};

export type SleepPatterns = {
  avgBedtime?: string;
  avgWakeTime?: string;
  avgSleepHours?: number;
  sleepQuality?: number;
};

export type UserProfileCore = {
  height: number; // cm
  weight: number; // kg
  age: number;
  gender?: 'male' | 'female' | 'other';
};

export type UserProfileOptional = {
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  goals?: string | null;
  medicalNotes?: string | null;
  workLifestyle?: WorkLifestyle | null;
  sleepPatterns?: SleepPatterns | null;
};

export type UserProfile = UserProfileCore &
  UserProfileOptional & {
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  };

export type UserProfileUpsertInput = UserProfileCore & Partial<UserProfileOptional>;
export type UserProfilePatchInput = Partial<UserProfileUpsertInput>;
