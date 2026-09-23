# 날짜/시각 처리 — KST 기준 날짜 경계

> **발견 경위(2026-09-23)**: 근태관리 도메인 사이클에서 사용자가 "체크인 관련 엣지케이스가 많을 것"이라 지적해, 코드를 다시 조사하다 발견했다. 도메인 하나의 문제가 아니라 5개 도메인에 걸친 횡단 결함이라 여기(architecture/)로 옮긴다.

## 문제

`new Date().toISOString().slice(0, 10)`로 "오늘 날짜"를 구하는 패턴이 코드베이스 전반에 있었다. 처음 조사할 땐 6곳으로 봤지만 실제 구현 시점에 다시 grep해 보니 **10곳**이었다(정직하게 정정 — 처음 셀 때 근태관리의 퇴사/파견 관련 2곳(`resignStaff`, `assignStaff`)과 `addYears` 헬퍼를 놓쳤다):

| 위치 | 도메인 | 용도 |
|---|---|---|
| `mock-data.service.ts:1150, 1176` | 근태관리 | 체크인/체크아웃 날짜(`AttendanceRecord.date`) |
| `mock-data.service.ts:653` | 회원관리 | `Member.joinedAt` 기본값 |
| `mock-data.service.ts:938` | 게시판 | `Post.publishedAt` |
| `mock-data.service.ts:1010` | 인사정보관리 | `Staff.hireDate` 기본값 |
| `mock-data.service.ts:1077` | 인사정보관리 | 퇴사 처리 시 `resignDate`/`StaffAssignment.endDate` |
| `mock-data.service.ts:1107` | 인사정보관리 | 파견 발령 시 기존 `StaffAssignment.endDate` |
| `mock-data.service.ts:1721` | 자원문서관리 | 퇴사 기준일 fallback(HR_RECORD 보존기한 계산 입력) |
| `mock-data.service.ts:1782` | 자원문서관리 | 보존기한 임박 판정 기준일 |
| `mock-data.service.ts:1708`(`addYears`) | 자원문서관리 | 별개 버그: 입력은 시간대 없는 문자열이라 로컬시간 파싱, 출력은 UTC 포맷 — 입출력 시간대가 서로 달랐음 |

**부수 발견**: 근태관리 `isLate()`(자동 지각 판정)는 이 패턴과 다르지만 같은 뿌리(호스트 시간대 의존)의 버그였다 — `standard.setHours()`가 서버 프로세스의 로컬 시간대를 썼다. 이 문서의 유틸로 함께 고쳤다.

`Date.prototype.toISOString()`은 사양상 **항상 UTC 기준**으로 포맷한다 — 서버 프로세스의 시간대 설정과 무관하다. 이 서비스는 한국(KST, UTC+9) 전용인데, **매일 00:00~08:59 KST(전날 15:00~23:59 UTC) 사이의 모든 이벤트가 하루 전 날짜로 기록된다.** 드문 경계 케이스가 아니라 매일 9시간씩 상시 발생하는 구조적 결함이다.

이 프로젝트 어디에도 `TZ` 환경변수 설정이 없다(`.github/workflows/ci.yml`, Docker 설정, `apps/api` 어디에도 없음 — 확인함). 로컬 개발 환경이 우연히 Asia/Seoul이라 지금은 안 보이지만, 애초에 `toISOString()` 자체가 프로세스 시간대와 무관하므로 `TZ`를 설정해도 이 특정 패턴은 안 고쳐진다(흔한 착각 — 아래 대안 A 참고).

## 대안 비교

| 대안 | 장점 | 단점 |
|---|---|---|
| A. `process.env.TZ = 'Asia/Seoul'`만 설정 | 간단해 보임 | **작동 안 함** — `toISOString()`은 TZ 설정과 무관하게 항상 UTC. 흔히 빠지는 함정이라 명시적으로 기록해 둔다 |
| B. `TZ` 설정 + `getFullYear()/getMonth()/getDate()`(로컬 시간대 반영)로 날짜 조합 | `Date` 기본 API만으로 해결 | 배포 환경에 `TZ` 설정을 빠뜨리면(컨테이너 기본값 UTC 등) 조용히 다시 버그로 돌아감 — 환경설정 의존적이라 재발 위험 |
| **C. 환경변수에 의존하지 않는 명시적 KST 변환 유틸(`toKstDateString(d: Date): string`, UTC+9 오프셋을 코드에 고정) — 채택** | 배포 환경이 어떻든 항상 정확, 환경설정 누락 재발 불가능 | 이미 있는 호출부를 전부 이 유틸로 교체해야 함 |
| D. 날짜 라이브러리(date-fns-tz, Luxon 등) 도입 | 장기적으로 가장 견고 | 새 의존성 — 이 프로젝트가 지금까지 계산성 문제(VAT 분리 등)를 순수 함수로 풀어 온 결과 이미 KST 하나만 고정하면 되는 문제라 라이브러리 없이도 충분 |

**결정**: C. 판단 기준: B는 "배포 시 환경변수 설정을 잊으면 재발"이라는, 딱 지금 겪은 것과 같은 종류의 재발 위험을 안고 간다 — 이 문제 자체가 "아무도 신경 안 쓴 설정 하나가 조용히 틀렸던" 사례라 같은 함정을 다시 놓지 않는다. D는 이 프로젝트 규모에 과함(고정 오프셋 하나만 있으면 되는 문제).

## 감수하는 것

- UTC+9를 코드에 고정한다 — 만약 이 서비스가 해외로 확장되면(계획에 없음) 이 가정을 다시 봐야 한다.
- 앞으로 새로 "오늘 날짜"가 필요한 곳은 반드시 이 유틸을 쓰도록 습관화해야 한다(코드 리뷰가 없는 1인 개발이라 강제 수단이 약함 — CLAUDE.md 규칙으로 대응, 아래 "다음 행동" 참고).

## 검증 현황 (2026-09-23 구현·검증 완료)

| 항목 | 상태 |
|---|---|
| `toKstDateString`/`todayKst`/`kstHoursMinutes`/`addYearsToDateString` 유틸 | **구현됨** — `apps/api/src/common/date/kst-date.ts` |
| 10개 호출부 전부 교체 | **구현됨** — `grep "toISOString().slice(0, 10)"` 결과 0건으로 확인 |
| `isLate()` 호스트 시간대 의존 제거 | **구현됨** |
| KST 경계(00:30, 23:59, 00:00 정각) 회귀 테스트 | **검증됨** — `apps/api/src/common/date/kst-date.spec.ts`(7건, 유닛 테스트) |
| `npm run test`(9 suites, 147 passed) / `eslint`(0 errors) / `nest build` | **검증됨** |

## 다음 행동 — 1~3 완료(2026-09-23), 4는 아래에 반영

1. ~~`toKstDateString` 유틸 작성~~ → 완료.
2. ~~10개 호출부 교체~~ → 완료(처음 집계한 6개보다 많았음, 위 표에서 정정).
3. ~~경계 시각 회귀 테스트~~ → 완료.
4. CLAUDE.md 규칙 추가 — "새 날짜 계산은 `apps/api/src/common/date/kst-date.ts`의 `todayKst()`/`toKstDateString()` 사용, `toISOString().slice(0,10)` 직접 쓰지 않는다."
