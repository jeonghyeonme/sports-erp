# 공유 엔티티 (옛 1-1 공통설계서 §2)

> `Branch`·`StaffAssignment` 같은 여러 도메인이 공유하는 엔티티의 **단일 진실 공급원**이다. 다른 문서에서 필드를 새로 정의하지 말고 여기를 참조한다. 실제 스키마는 `apps/api/prisma/schema.prisma`(+ 마이그레이션 SQL의 제약)가 최종 기준이다. 절 번호는 옛 1-1 공통설계서 그대로다(2026-10-01 이관).

## 2. 전체 ERD 개요 (엔티티 목록)

상세 컬럼은 각 도메인 문서 부록 A-3에서 정의합니다. 여기서는 **엔티티 간 관계**만 전체 조망합니다.

> **정합성 참고(2026-10-14 갱신)**: 아래 블록은 `schema.prisma`의 모델 31개를 기준으로 다시 맞췄다. 2026-09-15판에 있던 `TrainingLog`·`AssetInventoryCheck(Item)`·`InstructorSettlement`는 스키마에 없다(교육 실시 기록·재물조사·강사 정산은 범위 제외 또는 미구현 — 각 도메인 부록 A-8). `Payment`는 지금 **예약 결제 전용**이다(`reservationId` 필수·unique, `ptSessionId` 없음).

```
Branch(지점) 1─N Facility(시설: 헬스장/수영장/골프장/독서실 등)
Branch 1─N StaffAssignment(파견 이력) N─1 Staff(직원, 본사 소속 — §2-2)
Branch 1─N Member(회원)
Branch 1─N Instructor(강사), Branch 1─N Program(프로그램/강좌)
Branch 1─N Post(게시글, branchId nullable — 본사 전체 공지는 null; facilityId nullable — 지점 공지의 대상 시설, 게시판 ADR-BRD-05) 1─N Attachment(첨부 — url에 저장소 경로, 게시판 ADR-BRD-04·D57), Post 1─N PostReadReceipt(읽음 — 미사용)
Branch 1─N Asset(자산·비품 — 자원문서관리 문서)
Branch 1─N SupportRequest(업무지원 요청, 현장→본사 — D56) N─1 Account(requesterId 지점 관리자, handlerId 본사 nullable)
Branch 1─N CodeSequence(지점·종류·연도별 채번 — staffCode·memberNo·assetCode, D28)
Document(문서 — 자원문서관리 문서) N─1 Branch(nullable, 전사 문서는 null), Document N─1 Staff(nullable, 인사서류인 경우), Document N─1 Account(올린 사람)

Account(로그인계정) 1─1 Staff  (Role=SUPER_ADMIN/BRANCH_ADMIN/STAFF)
Account 1─1 Member            (Role=MEMBER, 오프라인 등록 회원은 계정 없음)
Account 1─N RefreshToken(갱신 토큰 — 권한관리 ADR-AUTH-04)
Account 1─N AccountPermission(개인 예외 권한 — D60, 권한관리 ADR-AUTH-07), RolePermission(역할 기본값 — 지점 관리자·직원, 관계 없음)
MemberLinkAttempt(회원 연동 실패 횟수 — 회원관리 ADR-MEM-01, 관계 없음)

Staff 1─N AttendanceRecord(근태기록, branchId 스냅샷 — 근태관리 ADR-ATT-03)
Staff 1─N LeaveRequest(휴가신청), Staff 1─N LeaveBalance(연도별 연차 잔여)
Staff 1─N WorkLog(업무일지, staffId+date unique)
Staff 1─N StaffProfileChangeRequest(이름·연락처 변경 신청 — 인사정보관리 ADR-STF-09)
Staff 0..1─1 Instructor(직원 겸임 강사, 선택)
Staff 1─N Member(담당 회원, assignedStaffId)

Facility 1─N Program(nullable)
Facility 1─N CongestionSnapshot(혼잡도 스냅샷 — 미사용)
Facility 1─N FacilityCheckIn N─1 Member(체크인/아웃 — 미사용, 입장 기록 기반 혼잡도는 보류 — 혼잡도관리 ADR-FAC-05)
Facility.currentCount = 예약 외 현장 인원(관리자 입력). 혼잡도 합계는 진행 중 회차의 예약 인원을 조회 때 더한다(ADR-FAC-05)

Program 1─N ScheduleSlot(회차), Program 1─N ProgramScheduleTemplate(회차 일괄 생성 틀 — 미사용)
Program N─1 Instructor(강사, nullable)
Program 1─N CourseEnrollment N─1 Member(수강내역, 회원관리 문서)

Member 1─N Reservation(예약)
Member 1─N PTSession(PT 잔여세션) 1─N PTSessionLog(세션 사용 로그)
ScheduleSlot 1─N Reservation
Reservation 1─0..1 Payment(결제 — "매출 인식의 원천", reservationId 필수·unique) N─1 Member
  — PT 패키지 구매 결제는 담지 않는다(예약및결제 A-8 범위 제외). `FREE_ACCESS`는 예약·결제 개념 자체가 없다

AuditLog(변경 이력) N─1 Account(actorId, nullable) — 모든 엔티티가 아니라 정한 action만 기록한다(아래 §2-3)
```

**핵심 설계 원칙(멀티테넌시 격리)**: `Branch`에 속한 엔티티(Staff, Member, Program, Post 등)는 반드시 `branchId`를 가지며, `BRANCH_ADMIN` 역할의 모든 조회/수정 API는 **자신의 branchId로 자동 필터링**됩니다(요구사항 5번 "타현장 정보 조회 불가능" 구현). `SUPER_ADMIN`만 전체 지점을 넘나들 수 있습니다.

### 2-1. Branch(지점) 데이터 모델 — 위탁계약 필드

§1-1에서 정리했듯 `Branch`는 "회사가 소유한 매장"이 아니라 "위탁운영 계약을 맺은 현장"입니다. 기존 설계는 `id/name/address`뿐이었는데, 이는 회원·직원을 지점별로 나누는 용도로는 충분해도 **"전산화 대상인 실제 업무"— 계약 관리 — 를 전혀 담지 못합니다.** 아래 필드를 추가합니다.

> **이 표가 `Branch`의 전체 스키마입니다.** 다른 문서(03, 06 등)에서 Branch에 필드가 더 필요하면 이 표에 추가하고 이 절을 참조하세요 — 문서마다 개별적으로 "Branch에 필드 추가"라고 선언하면 스키마가 여러 곳에 흩어져 전체를 한눈에 볼 수 없게 됩니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID (PK) | |
| name | string | 지점명(예: "서초점") |
| address | string, nullable | |
| phone | string, nullable | 지점 대표 전화 |
| region | string | 광역 단위(예: "서울", "경기") — `address`(상세 주소)와 별개로 대시보드에서 지점을 지역별로 묶어 보여주는 데 사용(2026-09-09 추가, D21) |
| code | string, unique | 지점 코드(staffCode/memberNo 생성에 사용, 3f6ea31 커밋에서 이미 추가됨) |
| contractPartner | string | 위탁계약 상대방(예: "서초 OO아파트 입주자대표회의") — 회원에게 노출되지 않는 관리자 전용 정보 |
| contractStartAt | date | 계약 시작일 |
| contractEndAt | date, nullable | 계약 종료(예정)일 — 상시계약 등 미정이면 null |
| contractStatus | enum(ACTIVE, RENEWAL_DUE, EXPIRED, TERMINATED) | 계약 상태. **본사가 `PATCH /branches/:branchId/contract-status`로 수동 변경한다**(자동 전이 배치는 없다 — 아래 비즈니스 로직) |
| renewalNoticeAt | (컬럼 없음, 조회 때 계산) | `contractEndAt - 60일`(정책값) — 갱신 알림 기준일. 응답의 `contractDaysLeft`·`renewalNotice`(상태가 정상인데 60일 이내)로 조회 때 계산해 대시보드·지점 상세에 표시만 한다([D68](../decisions/D68.md)). 상태 자동 전이는 없다 |
| standardCheckInTime | string("HH:mm"), nullable | 지점별 출근 기준 시각(예: "09:00"). 10분 초과 시 지각 자동 판정에 사용 — [03_근태관리 §6](../domains/근태관리.md) |
| cancellationDeadlineHours | int, nullable | 예약 무료취소 기준 시간(예: 24 → 24시간 전까지 무료 취소, 그 이내는 환불 불가). nullable이면 전역 기본값 사용. Program 단위로 override 가능하면 Program에도 nullable로 둘 수 있음 — [06_예약및결제 §6](../domains/예약및결제.md) |
| isActive | boolean, default true | 지점 사용 여부(계약 상태와 별개) |

인덱스: `Branch.contractStatus`(본사 대시보드에서 "갱신 임박 지점" 조회용), `Branch.contractEndAt`, `Branch.isActive`, `Branch.region`

**비즈니스 로직**: 계약 상태는 본사가 지점 상세의 "계약 상태 변경"(`PATCH /branches/:branchId/contract-status`)으로 바꾸고, 계약 갱신(`POST /branches/:branchId/contract/renewals` — 새 종료일, 상태를 정상으로, 종료 지점은 409)도 상태를 정상으로 돌린다. 오타 정정(`PATCH /branches/:branchId/contract`)은 상태를 바꾸지 않는다. 셋 다 본사 전용이고 변경 이력(AuditLog, entity `Branch`)에 같은 트랜잭션으로 남는다([D68](../decisions/D68.md)). 신규 지점 등록은 아직 없다. 원래 설계한 "매일 배치로 임박 지점을 `RENEWAL_DUE`로 자동 전이 + 대시보드 알림 카드"는 스케줄러가 없어 구현하지 않았다(설계만). `TERMINATED` 지점은 물리 삭제하지 않고(소프트 삭제 원칙, §5) 과거 데이터(회원/결제 이력) 조회는 유지하되 신규 회원 등록·예약은 차단합니다. 상세 기능 설계는 [13_차별화전략](../reference/차별화전략.md) §1을 참고하세요 — 이 필드들은 "위탁계약 라이프사이클 관리"라는 차별화 기능의 기반 데이터입니다. 이 필드들을 수기 입력 대신 계약서 스캔본에서 OCR·AI로 자동 추출하는 기능은 [차별화전략 §1-1](../reference/차별화전략.md#1-1-계약서-ocrai-분석-2026-09-08-추가-스코프를-계약서-1종으로-한정)에서 다룹니다(계약서 1종에 한정, 프로그램 신청서·자격증 등은 보류).

**TERMINATED 전이가 하위 도메인에 미치는 영향** — "신규 회원 등록·예약 차단"은 선언만으로 끝나지 않고, 각 도메인의 실제 API 전제조건에 반영되어야 합니다:
- 회원 등록(`POST /api/v1/members`): `Branch.contractStatus`가 `TERMINATED`면 409 — [05_회원관리](../domains/회원관리.md) 참고
- 예약 생성(`POST /api/v1/reservations`): 동일하게 409 — [06_예약및결제](../domains/예약및결제.md) 참고
- 게시판: TERMINATED 지점의 기존 공지는 열람만 유지하고 신규 작성은 차단 — [04_게시판_공지사항](../domains/게시판.md) 참고
- 계정: 지점이 TERMINATED되면 그 지점 소속 계정 전체를 어떻게 처리할지는 개인 퇴사 처리와 별개 정책 — [01_권한관리](../domains/권한관리.md) 참고 — 일괄 비활성화하지 않고(권한관리 ADR-AUTH-02), 본사가 재배치하지 않을 직원을 퇴사 처리해 계정을 닫는다(인사정보관리 ADR-STF-08 — 이 경우만 SUPER_ADMIN도 퇴사 처리)
- 파견 직원: TERMINATED 지점에 현재 파견 중(`StaffAssignment.endDate=null`)인 직원이 있으면, 그 파견을 종료 처리하고 본사가 재배치할 대상 목록에 올려야 함 — 아래 §2-2, [02_인사정보관리](../domains/인사정보관리.md) 참고 — **구현**: 본사 `PATCH /branches/:branchId/contract-status`가 TERMINATED로 바꿀 때 같은 트랜잭션에서 종료하고 재배치 대상을 응답으로 돌려준다(인사정보관리 ADR-STF-07). `Staff.branchId`는 그대로 남는다(활성 파견 없는 재직 직원 = 재배치 대기)

### 2-2. Staff(직원) 파견(Assignment) 모델

§1-1에서 정리했듯, 원본 RFP는 "행정 및 트레이너들 역시 해당 지역 또는 본사 파견 형태로 직원이 투입"된다고 명시합니다. 즉 `Staff`는 "지점이 직접 고용한 인력"이 아니라 **"스포이즘 본사가 고용해 현장에 파견한 인력"**입니다. 이 원칙에 따라 `Staff.branchId`는 "고정 소속"이 아니라 **"현재 파견 지점"**을 가리키는 비정규화 캐시 필드로 재정의하고, 파견 이력의 원천은 별도 엔티티 `StaffAssignment`가 담당합니다.

- **`Staff.branchId`**: 현재 활성(`endDate=null`) `StaffAssignment.branchId`와 항상 동기화되는 캐시. 지점 격리 로직(전역 `BranchScopeGuard`, D46 — [system-overview](system-overview.md) §3.3)은 이 필드를 그대로 사용하면 되므로, 1-2/1-4/1-6/강사프로그램게시 문서의 권한 필터링 로직 자체는 변경할 필요가 없습니다 — 바뀌는 것은 "이 값이 언제, 누구에 의해 갱신되는가"입니다.
- **`StaffAssignment`**: `id, staffId(FK), branchId(FK), startDate, endDate(nullable — null=현재 진행 중), assignedBy(FK→Account, 항상 SUPER_ADMIN), note`. 상세 필드·API는 [02_인사정보관리 §3~§7](../domains/인사정보관리.md)에서 정의합니다.
- **채용·배치 권한**: 신규 채용 등록과 파견 발령(재배치)은 **SUPER_ADMIN 전용**입니다 — 본사가 채용·배치의 주체라는 원본 구조를 그대로 반영합니다. BRANCH_ADMIN은 "현재 파견되어 있는 인력"의 일상적 인사 관리(수정, 퇴사 처리)만 담당합니다. 예외: 계약 종료(TERMINATED) 지점 직원의 퇴사는 본사도 처리한다(인사정보관리 ADR-STF-08 — 그 지점 관리자도 파견이 끝나 손댈 사람이 없을 수 있다).
- 이 모델은 스텁이나 스트레치 기능이 아니라 **원본 RFP가 명시한 기본 고용구조**이므로 Phase 1 핵심 데이터 모델에 포함됩니다(차별화전략 §3에 한때 "확인 전 보류"로 있었으나, 원본 재확인 후 이 위치로 승격·이관되었습니다).

### 2-3. AuditLog(변경 이력)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID (PK) | |
| actorId | FK → Account, nullable | 변경한 사람 |
| entity | string | 대상 종류(예: `Staff`, `Member`) |
| entityId | string | 대상 id |
| action | string | 아래 표 |
| before / after | JSON, nullable | 바뀐 값 |
| createdAt | timestamp | |

인덱스: `(entity, entityId)`. 기록은 쓰기와 같은 트랜잭션에서 `recordAudit`(`apps/api/src/prisma/audit.ts`)로 한다. 조회는 SUPER_ADMIN `GET /audit-logs`·admin-web "변경 이력"만.

| action | 언제 | 근거 |
|---|---|---|
| `ROLE_CHANGED` | 직원 역할 전환 | D44 |
| `RESIGNED` | 직원 퇴사 | D44 |
| `ASSIGNED` | 파견 발령 | D44 |
| `ASSIGNMENT_ENDED` | 지점 TERMINATED 전이로 진행 중 파견 종료 | 인사정보관리 ADR-STF-07 |
| `PHONE_VIEWED` | 관리자가 회원·직원 상세를 열 때(본인 조회 제외) | D47 |
| `ATTENDANCE_CORRECTED` | 지점 관리자의 근태 정정·누락일 등록(entity=Staff) | D52, 근태관리 ADR-ATT-04 |
| `MEMBER_STATUS_CHANGED` | 회원 상태가 실제로 바뀔 때 | D52 |
| `ASSET_STATUS_CHANGED` | 자산 상태 전이 | D52 |
| `STAFF_PROFILE_CHANGED` | 인사 변경 신청 승인(연락처는 값 없이 항목만) | 인사정보관리 ADR-STF-09 |

그 밖의 쓰기는 기록하지 않는다. 업무지원 요청(D56)은 요청 행 자체에 처리자·처리 시각·답변이 남아 따로 기록하지 않는다. 보존·삭제 규칙은 [data-retention](data-retention.md).

### 2-4. SupportRequest(업무지원 요청, D56)

현장(지점 관리자)이 본사에 올리는 지원 요청 — RFP 개념도(p.4) 현장→본사 흐름. 처리는 본사(SUPER_ADMIN)만.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID (PK) | |
| branchId | FK → Branch | 요청한 지점(요청자 소속, 서버가 정한다) |
| requesterId | FK → Account | 요청한 지점 관리자 |
| category | enum | FACILITY(시설)·STAFFING(인력)·SUPPLIES(물품)·IT(전산)·OTHER |
| title / content | string | 제목(2~100자)·내용(2~2,000자) |
| status | enum | REQUESTED → IN_PROGRESS → DONE, 또는 REJECTED(REQUESTED·IN_PROGRESS에서). DONE·REJECTED는 종결 |
| handlerId | FK → Account, nullable | 마지막으로 상태를 바꾼 본사 관리자 |
| response | string, nullable | 본사 답변 — REJECTED면 필수 |
| resolvedAt | timestamp, nullable | DONE·REJECTED일 때만 값이 있다 |
| createdAt / updatedAt | timestamp | |

인덱스: `(branchId, status)`, `(status, createdAt)`. **DB CHECK**(마이그레이션 SQL에만, D28 방식): 반려면 답변이 비어 있지 않다(`SupportRequest_rejected_response_ck`), 종결 상태와 `resolvedAt` 유무가 일치한다(`SupportRequest_resolved_at_ck`). 계약 종료 지점은 새 요청 409.
