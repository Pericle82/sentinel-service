import type { JobRegistry } from '@/application/ports/jobs/JobRegistry.js';

export type RunJob = {
  execute(name: string): Promise<void>;
};

export function createRunJob(jobRegistry: JobRegistry): RunJob {
  return {
    async execute(name) {
      await jobRegistry.run(name);
    }
  };
}
