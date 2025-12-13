import cron from 'node-cron';
import type { Job } from '@/application/ports/jobs/JobRegistry.js';

export type ScheduledJob = {
  name: string;
  stop(): void;
};

export function scheduleCronJob(options: { cronExpr: string; job: Job; enabled: boolean }): ScheduledJob {
  if (!options.enabled) {
    return {
      name: options.job.name,
      stop() {}
    };
  }

  const task = cron.schedule(options.cronExpr, () => {
    void options.job.run();
  });

  return {
    name: options.job.name,
    stop() {
      task.stop();
    }
  };
}
