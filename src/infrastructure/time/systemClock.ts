import type { Clock } from '@/application/ports/Clock.js';

export function createSystemClock(): Clock {
  return {
    now() {
      return new Date();
    }
  };
}
