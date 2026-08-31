import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Carries the {code, message, details} shape from 09_API Specification,
 * Section 2.5, through Nest's exception pipeline unchanged.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}

export class ConflictAppException extends AppException {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, HttpStatus.CONFLICT, details);
  }
}

export class ForbiddenAppException extends AppException {
  constructor(message = 'You do not have permission to perform this action.') {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundAppException extends AppException {
  constructor(message = 'Resource not found.') {
    super('NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }
}

// 09_API Specification, Section 2.5 — accounting-specific 422 codes.
export class UnbalancedEntryException extends AppException {
  constructor(message: string, details?: unknown) {
    super('UNBALANCED_ENTRY', message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class PeriodClosedException extends AppException {
  constructor(message = 'This financial period is closed.') {
    super('PERIOD_CLOSED', message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
