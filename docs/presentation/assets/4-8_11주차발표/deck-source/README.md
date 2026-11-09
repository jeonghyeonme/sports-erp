# 11주차 발표 덱 — 생성 소스

구성안은 상위 문서 `4-8_11주차발표_슬라이드구성.md`.

- **게시된 덱:** https://claude.ai/artifact/XVecKCuRR2Js23EYSAgDVk (비공개 — 공유는 소유자가 Share 메뉴에서)
- 2026-11-09 21장 게시 → 같은 날 사용감의 단계 수 막대·빠른 찾기 캡처 2장을 변경 전·후 단계별 캡처 비교 3장으로 바꿔 22장(사용자 요청). 디자인은 10주차 덱(https://claude.ai/artifact/YS4CX2S87R882cwTdjPxzZ, 생성기 없이 직접 쓴 슬라이드)을 따랐다. 게시 후 렌더 결과는 눈으로 확인하지 않았다.

```bash
cd docs/presentation/assets/4-8_11주차발표/deck-source
python3 viz/deck48.py deck-out          # deck-out/dots.svg(10주차 표지의 점 격자)를 장식으로 쓴다
```

게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로. 캡처는 아티팩트 자산(`/_blob/<id>`, `deck48.py`의 `IMG`)이라 새 아티팩트로 옮기면 다시 올려야 한다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `capture/` | `capture.cjs`(관리자 웹 캡처, Playwright) · `crop.py`(덱 프레임 비율로 자르기) · `compare.cjs`·`crop-compare.py`(변경 전·후 단계별 캡처) |
| `viz/` | `deck48.py` — 덱 생성기 |
| `deck-out/project/` | 생성 결과(`deck.json` + `slides/*.html`), 게시본과 같은 스냅샷. `deck-out/dots.svg`는 생성기 입력 |
| `screenshots/` | 원본 캡처(2880×1800)와 덱에 넣은 `deck-*.png`(2420×1270) |

| 덱에 넣은 파일 | 슬라이드 | 화면 · 계정 |
|---|---|---|
| `compare/step-pt-before-1~6.png` · `step-pt-after-1~3.png` | `ux-pt-compare`·`ux-pt-after` | PT 세션 차감 변경 전 6단계·변경 후 3단계, 누르는 곳에 주황 테두리·번호 · 김민수(서초점 지점 관리자), 회원 이수진 |
| `compare/step-slot-before.png` · `step-slot-after-1~2.png` | `ux-slot-compare` | 예약 관리 — 변경 전 화면 전체(첫 화면 경계 점선·회차 등록 폼 실선), 변경 후 머리글 버튼·모달 · 김민수 |
| (`deck-ux-quick.png`) | (뺐음) | 대시보드 위 상단 바 회원 빠른 찾기 — 비교 슬라이드로 대체 |
| `deck-list-assets.png` | `list-shot` | 자산 목록, 취득가액 내림차순 · 김민수 |
| `deck-doc-box.png` | `doc-shot` | 문서함, 시연용 PDF 1건을 올린 뒤 · 김민수 |
| `deck-chart-hq.png` | `chart-shot` | 본사 대시보드 전사 운영 실적 · 정하늘(본사) |

보조: `doc-upload.png`(문서 등록 모달), `chart-hq-top.png`(본사 대시보드 위쪽 숫자 카드).

## 다시 찍기

1. 로컬 DB를 비우고 시연 데이터를 얹는다(`seed:demo`는 이미 얹힌 DB를 거부한다): `apps/api`에서 `.env`를 셸에 읽어 들인 뒤 `npx prisma migrate reset --force --skip-seed` → `npm run seed:demo`. 문서 올리기가 실제로 한 건을 만들므로 다시 찍을 때마다 이 단계부터.
2. api(`npm run build --workspace=apps/api` 후 `node dist/main.js`, 포트 3000)와 관리자 웹(`apps/admin-web`에서 `npx vite --port 5173`)을 띄운다.
3. 저장소 루트에서 `node docs/presentation/assets/4-8_11주차발표/deck-source/capture/capture.cjs docs/presentation/assets/4-8_11주차발표/deck-source/screenshots`(브라우저 경로는 `PW_CHROMIUM_PATH`), 그다음 이 폴더에서 `python3 capture/crop.py screenshots`.

## 변경 전·후 비교 다시 찍기

변경 전 = `bd1fd0f`(log/198 측정 기준선, D72·D73 이전). 별도 작업 폴더와 별도 DB에 띄운다.

1. `git worktree add --detach <폴더> bd1fd0f` → 그 폴더에서 `npm ci`.
2. Postgres에 `sports_erp_old` DB를 만들고, `<폴더>/apps/api/.env`를 저장소 `.env`에서 DB 이름만 바꿔 만든 뒤 `.env`를 셸에 읽어 들여 `npx prisma generate` → `npx prisma migrate deploy` → `npm run seed:demo` → `npm run build`.
3. 지금 앱 서버를 끄고, 같은 포트로 옛 api(`node dist/main.js`, 3000)와 옛 관리자 웹(`npx vite --port 5173`)을 띄운다(관리자 웹의 api 주소가 3000으로 고정).
4. `node docs/presentation/assets/4-8_11주차발표/deck-source/capture/compare.cjs before docs/presentation/assets/4-8_11주차발표/deck-source/screenshots/compare`.
5. 옛 서버를 끄고 지금 앱을 띄워 같은 명령을 `after`로. 그다음 이 폴더에서 `python3 capture/crop-compare.py screenshots/compare`.

PT 세션 차감은 "세션 사용"을 누르기 직전까지만 찍어 데이터를 바꾸지 않는다. 회차 등록은 모달을 여는 데까지만.

## 알려진 한계

- **로컬 실행 화면이다**(2026-11-09 `dev` `ba557f2` + `seed:demo`), 배포본이 아니다. 로그인은 화면의 데모 계정 버튼(비밀번호 입력 자동화 없음). 머리말 아래 개발용 안내 문구는 숨겼다.
- 시연 데이터는 실행일 기준 지난 90일만 만든다 — 차트의 8월 이전 예약·매출은 거의 비어 있다. 날짜가 들어간 화면은 찍은 날 기준이라 다시 찍으면 바뀐다.
- 변경 전 화면은 옛 커밋의 앱이다 — 그 뒤 바뀐 다른 부분(검색 버튼, 화면 안 순서 등)도 함께 옛 모습이다. 강조 테두리·번호와 첫 화면 경계 점선은 캡처 때 겹친 표시다.
- 시설 화면은 1440px 폭에서 시설 카드의 버튼이 세로로 찌그러져 캡처 배경으로 쓰지 않았다(발표 뒤 고칠 화면 문제).
