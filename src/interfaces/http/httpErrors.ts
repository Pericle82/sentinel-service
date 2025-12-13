import { ApplicationError } from '@/application/errors.js';
import { DomainError } from '@/domain/errors.js';

export type HttpProblem = {
  error: string;
  message: string;
  details?: Record<string, unknown>;
};

function withOptionalDetails(details?: Record<string, unknown>) {
  return details ? { details } : {};
}

export function mapErrorToHttp(err: unknown): { statusCode: number; body: HttpProblem } {
  if (err instanceof DomainError) {
    const statusCode =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'UNAUTHORIZED'
          ? 401
          : err.code === 'FORBIDDEN'
            ? 403
            : err.code === 'CONFLICT'
              ? 409
              : 400;

    return {
      statusCode,
      body: {
        error: err.code,
        message: err.message,
        ...withOptionalDetails(err.details)
      }
    };
  }

  if (err instanceof ApplicationError) {
    return {
      statusCode: err.code === 'VALIDATION_FAILED' ? 400 : 502,
      body: {
        error: err.code,
        message: err.message,
        ...withOptionalDetails(err.details)
      }
    };
  }

  if (err instanceof Error) {
    return {
      statusCode: 500,
      body: {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected error'
      }
    };
  }

  return {
    statusCode: 500,
    body: {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error'
    }
  };
}
