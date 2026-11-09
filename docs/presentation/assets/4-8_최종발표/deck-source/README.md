# 최종 발표 덱 — 생성 소스

구성안은 상위 문서 `4-8_최종발표_슬라이드구성.md`.

- **게시된 덱:** https://claude.ai/artifact/XVecKCuRR2Js23EYSAgDVk (비공개 — 공유는 소유자가 Share 메뉴에서)
- 2026-11-09 21장 게시. 디자인은 10주차 덱(https://claude.ai/artifact/YS4CX2S87R882cwTdjPxzZ, 생성기 없이 직접 쓴 슬라이드)을 따랐다. 게시 후 렌더 결과는 눈으로 확인하지 않았다.

```bash
cd docs/presentation/assets/4-8_최종발표/deck-source
python3 viz/deck48.py deck-out          # deck-out/dots.svg(10주차 표지의 점 격자)를 장식으로 쓴다
```

게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로. 캡처는 아티팩트 자산(`/_blob/<id>`, `deck48.py`의 `IMG`)이라 새 아티팩트로 옮기면 다시 올려야 한다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `capture/` | `capture.cjs`(관리자 웹 캡처, Playwright) · `crop.py`(덱 프레임 비율로 자르기) |
| `viz/` | `deck48.py` — 덱 생성기 |
| `deck-out/project/` | 생성 결과(`deck.json` + `slides/*.html`), 게시본과 같은 스냅샷. `deck-out/dots.svg`는 생성기 입력 |
| `screenshots/` | 원본 캡처(2880×1800)와 덱에 넣은 `deck-*.png`(2420×1270) |

| 덱에 넣은 파일 | 슬라이드 | 화면 · 계정 |
|---|---|---|
| `deck-ux-quick.png` | `ux-quick-shot` | 대시보드 위 상단 바 회원 빠른 찾기("이수") · 김민수(서초점 지점 관리자) |
| `deck-list-assets.png` | `list-shot` | 자산 목록, 취득가액 내림차순 · 김민수 |
| `deck-doc-box.png` | `doc-shot` | 문서함, 시연용 PDF 1건을 올린 뒤 · 김민수 |
| `deck-chart-hq.png` | `chart-shot` | 본사 대시보드 전사 운영 실적 · 정하늘(본사) |

보조: `doc-upload.png`(문서 등록 모달), `chart-hq-top.png`(본사 대시보드 위쪽 숫자 카드).

## 다시 찍기

1. 로컬 DB를 비우고 시연 데이터를 얹는다(`seed:demo`는 이미 얹힌 DB를 거부한다): `apps/api`에서 `.env`를 셸에 읽어 들인 뒤 `npx prisma migrate reset --force --skip-seed` → `npm run seed:demo`. 문서 올리기가 실제로 한 건을 만들므로 다시 찍을 때마다 이 단계부터.
2. api(`npm run build --workspace=apps/api` 후 `node dist/main.js`, 포트 3000)와 관리자 웹(`apps/admin-web`에서 `npx vite --port 5173`)을 띄운다.
3. 저장소 루트에서 `node docs/presentation/assets/4-8_최종발표/deck-source/capture/capture.cjs docs/presentation/assets/4-8_최종발표/deck-source/screenshots`(브라우저 경로는 `PW_CHROMIUM_PATH`), 그다음 이 폴더에서 `python3 capture/crop.py screenshots`.

## 알려진 한계

- **로컬 실행 화면이다**(2026-11-09 `dev` `ba557f2` + `seed:demo`), 배포본이 아니다. 로그인은 화면의 데모 계정 버튼(비밀번호 입력 자동화 없음). 머리말 아래 개발용 안내 문구는 숨겼다.
- 시연 데이터는 실행일 기준 지난 90일만 만든다 — 차트의 8월 이전 예약·매출은 거의 비어 있다. 날짜가 들어간 화면은 찍은 날 기준이라 다시 찍으면 바뀐다.
- 시설 화면은 1440px 폭에서 시설 카드의 버튼이 세로로 찌그러져 캡처 배경으로 쓰지 않았다(발표 뒤 고칠 화면 문제).
