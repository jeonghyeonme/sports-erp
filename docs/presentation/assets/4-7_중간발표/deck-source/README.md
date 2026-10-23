# 중간발표 덱 — 생성 소스

구성안은 상위 문서 `4-7_중간발표_슬라이드구성.md`.

- **게시된 덱:** https://claude.ai/artifact/M2NBGeZcaBdTgkT1msjwQb (비공개 — 공유는 소유자가 Share 메뉴에서)
- 2026-10-23 1차(맞물림 지도·시나리오) 확인 후 Ⅰ~Ⅶ 전체 55장을 게시했다. 게시 후 렌더 결과는 눈으로 확인하지 않았다(사용자 확인).

```bash
node viz/deck47.js deck-out    # 6주차 deck46.js와 같은 디자인·린트
```

게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로. 캡처는 아티팩트 자산(`/_blob/<id>`, `deck47.js`의 `IMG`)이다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `capture/` | `capture.cjs`(관리자 웹 4장 + 회원 웹 3장, Playwright) · `sheet.sh`(엑셀 판정 시트 1장, LibreOffice) |
| `viz/` | `deck47.js` — 덱 생성기 |
| `deck-out/project/` | 생성 결과(`deck.json` + `slides/*.html`), 게시본과 같은 스냅샷 |
| `screenshots/` | 로컬에서 찍은 캡처(아래 표) |

| 파일 | 슬라이드 | 화면 · 계정 |
|---|---|---|
| `after-support.png` | A3 `after-support` | 업무지원 요청 — 강남점 요청 처리 창(처리중·완료·반려, 답변) · 정하늘(본사) |
| `after-qa.png` | A6 `after-qa` | 마포점(갱신 임박) 지점 상세 — 계약 정보 + 운영 실적(최근 3개월) · 정하늘 |
| `after-permission.png` | A7 `after-permission` | 권한 관리 — 역할 기본 권한(지점 관리자, 기능 15개 × 조회·입력·수정·삭제·출력) · 정하늘 |
| `ov-scope-admin.png` | B3 `ov-scope` | 회원 상세(상단 경로 `홈 › 회원 서비스 › 회원 › 회원 상세`) · 김민수(서초점 지점 관리자) |
| `ov-scope-member-2-pay.png` | B3 `ov-scope` | 회원 모바일 웹 결제 단계(모의 카드 결제, 실제 청구 없음) · 이수진(서초점 회원) — **덱에 넣는 장** |
| `ov-scope-member-1-slot.png`·`-3-done.png` | (보조) | 같은 흐름의 회차 선택·결제 완료(승인 번호 `MOCK-…`) — 노트·질문용 |
| `scn-hq-dashboard.png`·`scn-branch-attendance.png` | 시나리오 화면 | RFP 이행 증빙 캡처(`scripts/deliverables/figs/rfp/` N6-2·F3-1, 2026-10-23)를 복사 |
| `scn-branch-timetable.png` | 시나리오 ② | 같은 캡처 N6-6에서 주간 시간표 부분만 잘라 냄 |
| `scn-member-home.png` | 시나리오 ③ | 같은 캡처 F8-1(회원 홈)의 위쪽을 휴대폰 틀 비율로 잘라 냄 |
| `appx-sheet.png` | X1 `appx-sheet` | 요구사항정의서.xlsx "RFP 충족 판정" — 집계(58/64 = 91%)·판정 기준·F1~F4 |

## 다시 찍기

1. 로컬 DB에 시연 데이터를 다시 얹는다: `apps/api`에서 `npm run seed:demo`(4-0 §5). 회원 웹 캡처는 실제로 예약·결제하므로 두 번 찍으려면 다시 얹는다.
2. 세 앱을 띄운다: `npm run dev:api` · `npm run dev:web` · `npm run dev:member`.
3. 저장소 루트에서 `node docs/presentation/assets/4-7_중간발표/deck-source/capture/capture.cjs docs/presentation/assets/4-7_중간발표/deck-source/screenshots`(브라우저 경로는 `PW_CHROMIUM_PATH`), 그리고 `bash docs/presentation/assets/4-7_중간발표/deck-source/capture/sheet.sh docs/presentation/assets/4-7_중간발표/deck-source/screenshots`.

## 알려진 한계

- **로컬 실행 화면이다**(2026-10-22 `dev` 기준 + `seed:demo`), 배포본이 아니다. 로그인은 화면의 데모 계정 버튼을 눌렀다(비밀번호 입력 자동화 없음). 관리자 화면은 2배 해상도(2880×1800), 머리말 아래 개발용 안내 문구와 마포 계약 정보 아래 OCR 설계 안내를 숨겼다. 회원 화면은 iPhone 13 에뮬레이션(실기기 아님).
- 날짜가 들어간 화면(회차 10월 26일, 운영 실적 2026-08~10)은 찍은 날 기준이다 — 다시 찍으면 바뀐다.
- `appx-sheet.png`는 엑셀 프로그램 화면이 아니라 LibreOffice 인쇄 렌더다.
