// 00문서 §4의 공통 응답 envelope. 성공 응답은 항상 이 헬퍼로 감싸서 반환합니다.
// meta는 페이지네이션({page,pageSize,total})뿐 아니라 경고 등 부가 정보({warnings})도 실을 수 있게 느슨한 타입을 씀.
export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return meta ? { success: true, data, meta } : { success: true, data };
}
