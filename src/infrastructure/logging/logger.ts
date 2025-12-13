import { type LoggerOptions } from 'pino';

export type LoggerConfig = LoggerOptions;

export function createLoggerConfig(options: { level: LoggerOptions['level']; nodeEnv: string }): LoggerConfig {
  const transport =
    options.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard'
          }
        }
      : undefined;

  return {
    level: options.level ?? 'info',
    base: null,
    ...(transport ? { transport } : {})
  };
}
