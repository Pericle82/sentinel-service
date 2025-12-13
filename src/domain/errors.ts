export type DomainErrorCode =
  | 'DOMAIN_RULE_VIOLATION'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT';

export class DomainError extends Error {
  public override readonly name = 'DomainError';

  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}
