import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

function isPaginated(value: unknown): value is Paginated<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as any).items) &&
    typeof (value as any).total === 'number'
  );
}

/**
 * Wraps every successful controller return value in the envelope from
 * 09_API Specification, Section 2.3:
 *   single resource -> { data, error: null }
 *   paginated list  -> { data, meta: {page, pageSize, total}, error: null }
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result) => {
        if (isPaginated(result)) {
          return {
            data: result.items,
            meta: { page: result.page, pageSize: result.pageSize, total: result.total },
            error: null,
          };
        }
        return { data: result ?? null, error: null };
      }),
    );
  }
}
