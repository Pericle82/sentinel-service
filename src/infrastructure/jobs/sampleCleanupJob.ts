import type { Job } from '@/application/ports/jobs/JobRegistry.js';

export function createSampleCleanupJob(deps: { log: (msg: string, meta?: Record<string, unknown>) => void }): Job {
  return {
    name: 'sample.cleanup',
    description: 'Example scheduled job (replace in real projects).',
    async run() {
      deps.log('sample.cleanup executed');
    }
  };
}
