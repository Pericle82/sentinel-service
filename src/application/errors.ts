export type ApplicationErrorCode = 'VALIDATION_FAILED' | 'DEPENDENCY_FAILURE';

export class ApplicationError extends Error {
  public override readonly name = 'ApplicationError';

  constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}
