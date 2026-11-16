# 12주차 발표 덱 — 생성 소스

구성안은 상위 문서 `4-9_12주차발표_슬라이드구성.md`.

- **게시된 덱:** https://claude.ai/artifact/XE6YHQsgbGyPxvbKt4vbM2 (비공개 — 공유는 소유자가 Share 메뉴에서). 2026-11-16 16장 게시.

```bash
cd docs/presentation/assets/4-9_12주차발표/deck-source
DECK_CREATED_AT=2026-11-16T08:29:15Z python3 viz/deck49.py deck-out   # 게시본의 createdOnFiles를 유지
```

게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로. 캡처는 아티팩트 자산(`/_blob/<id>`, `deck49.py`의 `IMG`)이라 새 아티팩트로 옮기면 다시 올려야 한다. 생성기의 공통 부품(색·머리말·카드·브라우저 프레임)은 11주차 `deck48.py`와 같다.

## 다시 찍기

1. 저장소 루트에서 `npm run build --workspace=apps/api` → `npm run build:web`(api·관리자 웹 빌드).
2. 변경 전 화면이 필요하면: 관리자 웹을 저장소 안 임시 폴더(예: `.tmp-old-admin`)에 복사하고, `ReservationsPage.tsx` 예약 현황 필터 줄의 `flexWrap: 'wrap'`과 `styles.css`의 `.table-scroll` 규칙을 지운 뒤 그 폴더에서 `npx vite build --outDir dist`. `e2e/serve.mjs`를 복사해 `DIST`를 그 dist로 바꾼 서버 스크립트를 만든다. 끝나면 임시 폴더를 지운다.
3. `e2e` 폴더에서 `PW_CHROMIUM_PATH=… node ../docs/presentation/assets/4-9_12주차발표/deck-source/capture/capture12.mjs ../docs/presentation/assets/4-9_12주차발표/deck-source/screenshots [변경 전 서버 스크립트]` — 화면 테스트 전용 DB를 비우고 시연 데이터를 얹은 뒤 찍는다.
4. `screenshots/`에서 자르기: 리포트 위쪽은 2880×1800 캡처의 (460,120)–(2880,1390), 800px 캡처는 상단 바까지 (448,0)–(1600,820). 인쇄본은 `pdftoppm -f 1 -l 1 -r 110 -png report-print.pdf report-print`.

## 알려진 한계

- **로컬 실행 화면이다**(2026-11-16 `dev` + 시연 데이터), 배포본이 아니다. 시연 데이터는 지난 90일만 있어 리포트의 "최근 6개월 증감"이 대부분 "앞 기간 기록 없음"이다.
- 변경 전 800px 화면은 옛 커밋 전체가 아니라 #158의 두 수정만 뺀 빌드다(상단 바·표 라벨은 log/233 수정 전 모습, 그 밖은 지금 모습).
