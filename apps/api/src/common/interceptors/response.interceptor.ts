import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Paginated } from '../types/paginated.interface';

function isPaginated(value: unknown): value is Paginated<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as Paginated<unknown>).items) &&
    typeof (value as Paginated<unknown>).total === 'number'
  );
}

/**
 * 컨트롤러가 반환한 값을 00문서 §4 공통 성공 envelope으로 감쌉니다.
 * - 서비스가 Paginated<T>({items,total,page,pageSize})를 반환하면
 *   { success:true, data: items, meta:{page,pageSize,total} }로 변환
 * - 그 외에는 { success:true, data: <반환값> }로 변환
 * - 이미 success 필드를 직접 세팅한 응답(app.controller의 /health 등)은 그대로 통과
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result) => {
        if (result && typeof result === 'object' && 'success' in result) {
          return result;
        }
        if (isPaginated(result)) {
          return {
            success: true,
            data: result.items,
            meta: { page: result.page, pageSize: result.pageSize, total: result.total },
          };
        }
        return { success: true, data: result === undefined ? null : result };
      }),
    );
  }
}
