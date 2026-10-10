# 데이터 보존·정리 — 자동 삭제가 없는 기록을 손으로 지우는 절차

> 지금 유효한 운영 절차만 둔다. 결정의 경위는 각 결정 문서에 있다. 앱이 스스로 정리하는 기록(refreshToken — ADR-AUTH-04)과 보존기한을 화면에서 관리하는 문서(ADR-RES-02·ADR-RES-03)는 여기 적지 않는다.
> 배포 DB(Supabase) 삭제는 **사용자 승인 대상**이다(루트 CLAUDE.md). 아래 SQL은 사용자가 SQL Editor에서 직접 실행한다.

## 1. 상세 전화번호 열람 기록(AuditLog `PHONE_VIEWED`) — 1년 보존, 수동 삭제

- **근거**: [D47](../decisions/D47.md) 결정 4(보존 1년, 자동 삭제 없음). 2026-10-10 log/101에서 수동 SQL(A안)로 정했다.
- **대상**: `action = 'PHONE_VIEWED'`인 행만. 인사 변경 기록(`ROLE_CHANGED`·`RESIGNED`·`ASSIGNED`·`ASSIGNMENT_ENDED`, D44)은 보존 기간이 없으므로 **지우지 않는다**.
- **주기**: 1년에 한 번. 기록은 2026-10-10 배포부터 쌓이므로 첫 실행은 **2027-10-10 이후**다. 그 전에는 지울 행이 없다.
- **재고 조건**: 아래 3단계의 용량이 50MB를 넘으면 D47 재고 트리거(자동화 또는 새 테이블)를 검토한다. 첫 1년 안에 넘으면 이 절차로는 지울 행이 없다.

### 실행 절차 (Supabase SQL Editor)

1. **미리 세기** — 지울 건수와 가장 오래된 시각을 확인한다. 0건이면 여기서 끝낸다.

   ```sql
   SELECT count(*) AS 지울_건수, min("createdAt") AS 가장_오래된
   FROM "AuditLog"
   WHERE action = 'PHONE_VIEWED' AND "createdAt" < now() - interval '1 year';
   ```

2. **지우기** — 한 트랜잭션으로 실행한다. `DELETE n`의 n이 1단계 건수와 크게 다르면 `COMMIT` 대신 `ROLLBACK`하고 원인을 본다.

   ```sql
   BEGIN;
   DELETE FROM "AuditLog"
   WHERE action = 'PHONE_VIEWED' AND "createdAt" < now() - interval '1 year';
   -- 결과 건수를 확인한 뒤
   COMMIT;
   ```

3. **용량 확인** — 지운 뒤 테이블 크기를 적어 둔다(디스크 반환은 Postgres autovacuum에 맡긴다).

   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('"AuditLog"')) AS 용량;
   ```

4. **기록** — 실행 날짜·지운 건수·용량을 `docs/log/`에 한 건 남긴다(wrap-up 절차).

**검증**: 로컬 PG16에서 1년 넘은 열람 기록·최근 열람 기록·1년 넘은 인사 변경 기록을 하나씩 넣고 1~3단계를 실행했다. 1년 넘은 열람 기록 1건만 지워졌다(2026-10-10, log/101). 배포 DB에서는 아직 실행하지 않았다.
