/**
 * KST 날짜 — date-time-handling 규칙. `new Date().toISOString().slice(0, 10)`은 UTC라 00:00~08:59 KST에 어제가 된다
 * (근태 화면에서 새벽 체크인 버튼이 막혔던 원인, log/127). 화면에서 "오늘"이 필요하면 이 함수만 쓴다.
 */
export function kstToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}
