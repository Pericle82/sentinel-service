import type { Clock } from '@/application/ports/Clock.js';

export interface HealthDto {
  status: 'ok';
  now: string;
}

export interface GetHealth {
  execute(): Promise<HealthDto>;
}

export function createGetHealth(clock: Clock): GetHealth {
  return {
    async execute() {
      return {
        status: 'ok',
        now: clock.now().toISOString()
      };
    }
  };
}
