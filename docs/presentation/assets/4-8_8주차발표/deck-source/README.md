# 8주차 발표 덱 — 생성 소스

8주차 진행 발표(2026-10-26 ~ 11-02) 덱(Slides 아티팩트)을 만드는 스크립트다. 구성안은 상위 문서 `4-8_8주차발표_슬라이드구성.md`.

- **게시된 덱:** https://claude.ai/artifact/YS4CX2S87R882cwTdjPxzZ (2026-11-02 게시, 17장, 비공개 — 공유는 소유자가 Share 메뉴에서 바꾼다)

## 폴더

| 폴더 | 내용 |
|---|---|
| `viz/` | `deck48.js`(덱 17장). 6주차 `deck46.js`의 디자인·린트를 그대로 가져왔고, 도식은 SVG 없이 카드·표로 그렸다 |
| `capture/` | `capture.cjs` — 캡처 1장(아래) |
| `screenshots/` | `c-rounds.png` — 마포점 지점 상세의 계약 정보·계약 회차·계약 이력(2318×1110) |
| `deck-out/project/` | `deck48.js` 결과(`deck.json` + `slides/*.html`). 게시본과 같은 스냅샷 |

## 다시 만들기·게시

```bash
node viz/deck48.js deck-out    # 끝에 린트(24px·<text>·SVG 52KB·요소 200개·노트 4000자)
```

게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로. 캡처는 아티팩트 자산(`/_blob/<id>`, `deck48.js`의 `IMG`)이라 새 아티팩트로 옮기면 `screenshots/`에서 다시 올린다. `x-icon`은 Slides 형식이 허용하는 이름만 쓴다(Activity·Book·Check·Clock·Lightbulb·Lock·Play·Warning 등 — format.md 목록).

## 캡처 다시 찍기

1. 빈 로컬 DB에 마이그레이션 → `apps/api`에서 `npm run seed:demo`(시연 데이터의 기존 지점은 "계약서 미등록"으로 시작한다).
2. `npm run dev:api` · `npm run dev:web`.
3. 저장소 루트에서 `node docs/presentation/assets/4-8_8주차발표/deck-source/capture/capture.cjs docs/presentation/assets/4-8_8주차발표/deck-source/screenshots`(브라우저 경로는 `PW_CHROMIUM_PATH`). 스크립트가 본사(정하늘) 데모 버튼으로 로그인해, 마포점 1회차에 샘플 계약서를 올리고 새 계약서로 갱신(2회차 2026-12-08 ~ 2028-12-07)한 뒤 계약 정보 영역을 찍는다 — 실제 API 조작이므로 다시 찍으려면 시연 데이터를 다시 얹는다.

## 알려진 한계

- 캡처는 로컬 실행 화면(2026-11-02, 클라우드 세션 컨테이너의 PostgreSQL 16)이다. 배포본이 아니다. 계약서 파일은 내용 없는 샘플 PDF다.
- 게시 후 렌더 결과를 눈으로 확인하지 않았다(4-0 §7 마지막 항목은 발표자가 확인).
