import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AppException } from '../app-exception';

/**
 * Maps every thrown exception onto the failure envelope from
 * 09_API Specification, Section 2.3/2.5:
 *   { "data": null, "error": { "code", "message", "details" } }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    if (exception instanceof AppException) {
      reply.status(exception.getStatus()).send({
        data: null,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details ?? null,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : (body as any)?.message ?? exception.message;
      const details = typeof body === 'object' ? (body as any)?.message : undefined;

      // SEC-05 polish: NestJS's ThrottlerException surfaces its raw class
      // name ("ThrottlerException: Too Many Requests") as the message —
      // replace it with the same clean, user-facing wording every other
      // error code in this envelope uses, rather than leaking an internal
      // exception class name.
      const cleanMessage =
        status === HttpStatus.TOO_MANY_REQUESTS
          ? 'Too many requests. Please wait a moment and try again.'
          : Array.isArray(message)
            ? 'Request validation failed.'
            : message;

      reply.status(status).send({
        data: null,
        error: {
          code: mapStatusToCode(status),
          message: cleanMessage,
          details: Array.isArray(details) ? details : null,
        },
      });
      return;
    }

    this.logger.error(exception);
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        details: null,
      },
    });
  }
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return 'ERROR';
  }
}
