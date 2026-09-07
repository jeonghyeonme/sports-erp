// 00문서 §4의 공통 응답 envelope. 성공 응답은 항상 이 헬퍼로 감싸서 반환합니다.
export function ok<T>(data: T, meta?: { page: number; pageSize: number; total: number }) {
  return meta ? { success: true, data, meta } : { success: true, data };
}
