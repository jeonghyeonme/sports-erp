# 공유 엔티티 (옛 1-1 공통설계서 §2)

> `Branch`·`StaffAssignment` 같은 여러 도메인이 공유하는 엔티티의 **단일 진실 공급원**이다. 다른 문서에서 필드를 새로 정의하지 말고 여기를 참조한다. 실제 스키마는 `apps/api/prisma/schema.prisma`(+ 마이그레이션 SQL의 제약)가 최종 기준이다. 절 번호는 옛 1-1 공통설계서 그대로다(2026-10-01 이관).

## 2. 전체 ERD 개요 (엔티티 목록)

상세 컬럼은 각 기능 문서(1-2~1-10)에서 정의합니다. 여기서는 **엔티티 간 관계**만 전체 조망합니다.

> **정합성 참고(2026-09-15)**: 이 블록은 Phase 6(자산·문서관리, 매출·정산, 교육기록) 신규 엔티티를 반영해 갱신했습니다. `Payment`의 관계는 특히 주의 — 더 이상 `Reservation`에만 붙지 않습니다(아래 다이어그램, 상세는 [예약및결제 문서](../domains/예약및결제.md) §3).

```
Branch(지점) 1─N Facility(시설: 헬스장/수영장/골프장/독서실 등)
Branch 1─N StaffAssignment(파견 이력) N─1 Staff(직원, 본사 소속 — §2-2)
Branch 1─N Member(회원)
Branch 1─N Program(프로그램/강좌)
Branch 1─N Post(게시글, scope=BRANCH_TO_MEMBER인 경우)
Branch 1─N TrainingLog(교육 실시 기록 — 게시판 문서)
Branch 1─N Asset(자산·비품 — 자원문서관리 문서), Asset 1─N AssetInventoryCheckItem
Branch 1─N AssetInventoryCheck(재물조사 회차) 1─N AssetInventoryCheckItem N─1 Asset
Document(문서 — 자원문서관리 문서) N─1 Branch(nullable, 전사 문서는 null), Document N─1 Staff(nullable, 인사서류인 경우)

Account(로그인계정) 1─1 Staff  (Role=SUPER_ADMIN/BRANCH_ADMIN)
Account 1─1 Member            (Role=MEMBER)

Staff 1─N AttendanceRecord(근태기록)
Staff 1─N LeaveRequest(휴가신청)
Staff 1─N WorkLog(업무일지)

Facility 1─N Program
Facility 1─N CongestionSnapshot(혼잡도 스냅샷)
Facility 1─N FacilityCheckIn(체크인/아웃 — 혼잡도 자동계산의 원천, 혼잡도관리 문서)

Program 1─N ScheduleSlot(회차/시간대)
Program N─1 Instructor(강사) 1─N InstructorSettlement(강사 정산 — 예약및결제 문서)
Program 1─N CourseEnrollment(수강내역, 회원관리 문서)

Member 1─N Reservation(예약)
Member 1─N PTSession(PT 잔여세션) 1─N PTSessionLog(세션 사용 로그)
ScheduleSlot 1─N Reservation

Payment(결제 — 예약및결제 문서, "매출 인식의 원천") N─1 Reservation(nullable, unique) 그리고 N─1 PTSession(nullable)
  — 둘 중 정확히 하나만 값을 가짐: 예약 결제(`PAID_SESSION`) 또는 PT 패키지 구매 결제(`PT_PACKAGE`). `FREE_ACCESS`는 예약·결제 개념 자체가 없고 FacilityCheckIn만 남음

모든 주요 엔티티 → AuditLog(변경이력)에 기록 (누가/언제/무엇을 변경했는지)
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
| region | string | 광역 단위(예: "서울", "경기") — `address`(상세 주소)와 별개로 대시보드에서 지점을 지역별로 묶어 보여주는 데 사용(2026-09-09 추가, D21) |
| code | string, unique | 지점 코드(staffCode/memberNo 생성에 사용, 3f6ea31 커밋에서 이미 추가됨) |
| contractPartner | string | 위탁계약 상대방(예: "서초 OO아파트 입주자대표회의") — 회원에게 노출되지 않는 관리자 전용 정보 |
| contractStartAt | date | 계약 시작일 |
| contractEndAt | date, nullable | 계약 종료(예정)일 — 상시계약 등 미정이면 null |
| contractStatus | enum(ACTIVE, RENEWAL_DUE, EXPIRED, TERMINATED) | 계약 상태. `RENEWAL_DUE`는 `contractEndAt` 임박(예: 60일 이내) 시 배치로 자동 전이 |
| renewalNoticeAt | date, computed | `contractEndAt - 60일`(정책값) — 갱신 알림 발송 기준일. 하드코딩 금지, Branch 또는 전역 설정값으로 관리 |
| standardCheckInTime | time | 지점별 출근 기준 시각(예: 09:00). 10분 초과 시 지각 자동 판정에 사용 — [03_근태관리 §6](../domains/근태관리.md) |
| cancellationDeadlineHours | int, nullable | 예약 무료취소 기준 시간(예: 24 → 24시간 전까지 무료 취소, 그 이내는 환불 불가). nullable이면 전역 기본값 사용. Program 단위로 override 가능하면 Program에도 nullable로 둘 수 있음 — [06_예약및결제 §6](../domains/예약및결제.md) |

인덱스: `Branch.contractStatus`(본사 대시보드에서 "갱신 임박 지점" 조회용), `Branch.contractEndAt`

**비즈니스 로직**: 매일 배치(Cron)로 `contractEndAt`이 임박한(`renewalNoticeAt` 경과) `ACTIVE` 지점을 `RENEWAL_DUE`로 전이하고, `SUPER_ADMIN` 대시보드에 알림 카드로 노출합니다. `TERMINATED` 지점은 물리 삭제하지 않고(소프트 삭제 원칙, §5) 과거 데이터(회원/결제 이력) 조회는 유지하되 신규 회원 등록·예약은 차단합니다. 상세 기능 설계는 [13_차별화전략](../reference/차별화전략.md) §1을 참고하세요 — 이 필드들은 "위탁계약 라이프사이클 관리"라는 차별화 기능의 기반 데이터입니다. 이 필드들을 수기 입력 대신 계약서 스캔본에서 OCR·AI로 자동 추출하는 기능은 [차별화전략 §1-1](../reference/차별화전략.md#1-1-계약서-ocrai-분석-2026-09-08-추가-스코프를-계약서-1종으로-한정)에서 다룹니다(계약서 1종에 한정, 프로그램 신청서·자격증 등은 보류).

**TERMINATED 전이가 하위 도메인에 미치는 영향** — "신규 회원 등록·예약 차단"은 선언만으로 끝나지 않고, 각 도메인의 실제 API 전제조건에 반영되어야 합니다:
- 회원 등록(`POST /api/v1/members`): `Branch.contractStatus`가 `TERMINATED`면 409 — [05_회원관리](../domains/회원관리.md) 참고
- 예약 생성(`POST /api/v1/reservations`): 동일하게 409 — [06_예약및결제](../domains/예약및결제.md) 참고
- 게시판: TERMINATED 지점의 기존 공지는 열람만 유지하고 신규 작성은 차단 — [04_게시판_공지사항](../domains/게시판.md) 참고
- 계정: 지점이 TERMINATED되면 그 지점 소속 계정 전체를 어떻게 처리할지는 개인 퇴사 처리와 별개 정책 — [01_권한관리](../domains/권한관리.md) 참고
- 파견 직원: TERMINATED 지점에 현재 파견 중(`StaffAssignment.endDate=null`)인 직원이 있으면, 그 파견을 종료 처리하고 본사가 재배치할 대상 목록에 올려야 함 — 아래 §2-2, [02_인사정보관리](../domains/인사정보관리.md) 참고 — **구현**: 본사 `PATCH /branches/:branchId/contract-status`가 TERMINATED로 바꿀 때 같은 트랜잭션에서 종료하고 재배치 대상을 응답으로 돌려준다(인사정보관리 ADR-STF-07). `Staff.branchId`는 그대로 남는다(활성 파견 없는 재직 직원 = 재배치 대기)

### 2-2. Staff(직원) 파견(Assignment) 모델

§1-1에서 정리했듯, 원본 RFP는 "행정 및 트레이너들 역시 해당 지역 또는 본사 파견 형태로 직원이 투입"된다고 명시합니다. 즉 `Staff`는 "지점이 직접 고용한 인력"이 아니라 **"스포이즘 본사가 고용해 현장에 파견한 인력"**입니다. 이 원칙에 따라 `Staff.branchId`는 "고정 소속"이 아니라 **"현재 파견 지점"**을 가리키는 비정규화 캐시 필드로 재정의하고, 파견 이력의 원천은 별도 엔티티 `StaffAssignment`가 담당합니다.

- **`Staff.branchId`**: 현재 활성(`endDate=null`) `StaffAssignment.branchId`와 항상 동기화되는 캐시. `BranchScopeGuard` 등 기존 지점 격리 로직(§3.3)은 이 필드를 그대로 사용하면 되므로, 1-2/1-4/1-6/강사프로그램게시 문서의 권한 필터링 로직 자체는 변경할 필요가 없습니다 — 바뀌는 것은 "이 값이 언제, 누구에 의해 갱신되는가"입니다.
- **`StaffAssignment`**: `id, staffId(FK), branchId(FK), startDate, endDate(nullable — null=현재 진행 중), assignedBy(FK→Account, 항상 SUPER_ADMIN), note`. 상세 필드·API는 [02_인사정보관리 §3~§7](../domains/인사정보관리.md)에서 정의합니다.
- **채용·배치 권한**: 신규 채용 등록과 파견 발령(재배치)은 **SUPER_ADMIN 전용**입니다 — 본사가 채용·배치의 주체라는 원본 구조를 그대로 반영합니다. BRANCH_ADMIN은 "현재 파견되어 있는 인력"의 일상적 인사 관리(수정, 퇴사 처리)만 담당합니다.
- 이 모델은 스텁이나 스트레치 기능이 아니라 **원본 RFP가 명시한 기본 고용구조**이므로 Phase 1 핵심 데이터 모델에 포함됩니다(차별화전략 §3에 한때 "확인 전 보류"로 있었으나, 원본 재확인 후 이 위치로 승격·이관되었습니다).

