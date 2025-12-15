import type { Job, JobName, JobRegistry } from '@/application/ports/jobs/JobRegistry.js';

export function createInMemoryJobRegistry(jobs: Job[] = []): JobRegistry {
  const map = new Map<JobName, Job>();
  for (const j of jobs) map.set(j.name, j);

  return {
    async list() {
      return [...map.keys()].sort();
    },
    async run(name: JobName) {
      const job = map.get(name);
      if (!job) throw new Error(`Unknown job: ${name}`);
      await job.run();
    }
  };
}
