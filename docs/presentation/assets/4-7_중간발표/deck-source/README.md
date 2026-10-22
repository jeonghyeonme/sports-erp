# 중간발표 덱 — 생성 소스

구성안은 상위 문서 `4-7_중간발표_슬라이드구성.md`. **덱은 아직 만들지 않았다** — 지금은 캡처 6장(+ 회원 웹 흐름 보조 2장)만 있다. 덱 생성기는 6주차 소스(`../../4-6_6주차발표/deck-source/viz/deck46.js`)를 복사해 시작한다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `capture/` | `capture.cjs`(관리자 웹 4장 + 회원 웹 3장, Playwright) · `sheet.sh`(엑셀 판정 시트 1장, LibreOffice) |
| `screenshots/` | 2026-10-22 로컬에서 찍은 캡처(아래 표) |

| 파일 | 슬라이드 | 화면 · 계정 |
|---|---|---|
| `after-support.png` | A3 `after-support` | 업무지원 요청 — 강남점 요청 처리 창(처리중·완료·반려, 답변) · 정하늘(본사) |
| `after-qa.png` | A6 `after-qa` | 마포점(갱신 임박) 지점 상세 — 계약 정보 + 운영 실적(최근 3개월) · 정하늘 |
| `after-permission.png` | A7 `after-permission` | 권한 관리 — 역할 기본 권한(지점 관리자, 기능 15개 × 조회·입력·수정·삭제·출력) · 정하늘 |
| `ov-scope-admin.png` | B3 `ov-scope` | 회원 상세(상단 경로 `홈 › 회원 서비스 › 회원 › 회원 상세`) · 김민수(서초점 지점 관리자) |
| `ov-scope-member-2-pay.png` | B3 `ov-scope` | 회원 모바일 웹 결제 단계(모의 카드 결제, 실제 청구 없음) · 이수진(서초점 회원) — **덱에 넣는 장** |
| `ov-scope-member-1-slot.png`·`-3-done.png` | (보조) | 같은 흐름의 회차 선택·결제 완료(승인 번호 `MOCK-…`) — 노트·질문용 |
| `appx-sheet.png` | X1 `appx-sheet` | 요구사항정의서.xlsx "RFP 충족 판정" — 집계(58/64 = 91%)·판정 기준·F1~F4 |

## 다시 찍기

1. 로컬 DB에 시연 데이터를 다시 얹는다: `apps/api`에서 `npm run seed:demo`(4-0 §5). 회원 웹 캡처는 실제로 예약·결제하므로 두 번 찍으려면 다시 얹는다.
2. 세 앱을 띄운다: `npm run dev:api` · `npm run dev:web` · `npm run dev:member`.
3. 저장소 루트에서 `node docs/presentation/assets/4-7_중간발표/deck-source/capture/capture.cjs docs/presentation/assets/4-7_중간발표/deck-source/screenshots`(브라우저 경로는 `PW_CHROMIUM_PATH`), 그리고 `bash docs/presentation/assets/4-7_중간발표/deck-source/capture/sheet.sh docs/presentation/assets/4-7_중간발표/deck-source/screenshots`.

## 알려진 한계

- **로컬 실행 화면이다**(2026-10-22 `dev` 기준 + `seed:demo`), 배포본이 아니다. 로그인은 화면의 데모 계정 버튼을 눌렀다(비밀번호 입력 자동화 없음). 관리자 화면은 2배 해상도(2880×1800), 머리말 아래 개발용 안내 문구와 마포 계약 정보 아래 OCR 설계 안내를 숨겼다. 회원 화면은 iPhone 13 에뮬레이션(실기기 아님).
- 날짜가 들어간 화면(회차 10월 26일, 운영 실적 2026-08~10)은 찍은 날 기준이다 — 다시 찍으면 바뀐다.
- `appx-sheet.png`는 엑셀 프로그램 화면이 아니라 LibreOffice 인쇄 렌더다.
