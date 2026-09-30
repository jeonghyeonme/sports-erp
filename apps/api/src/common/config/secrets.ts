/**
 * 비밀값을 환경변수에서 읽는다 — D37 결정 5.
 * 로컬·테스트에서는 개발용 기본값을 쓰지만, 배포 환경(Lambda 또는 NODE_ENV=production)에서 값이 없으면 부팅을 실패시킨다.
 * 기본값으로 조용히 뜨면 공개된 문자열(`change-me`)로 누구나 토큰을 위조할 수 있기 때문이다.
 */
export function isDeployedRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function secretFromEnv(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isDeployedRuntime()) {
    throw new Error(`${name} 환경변수가 없습니다 — 배포 환경에서는 개발용 기본값을 쓰지 않는다(D37 결정 5).`);
  }
  return devFallback;
}
