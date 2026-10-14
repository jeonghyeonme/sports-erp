# 6주차 발표 덱 — 생성 소스

6주차 진행 발표(2026-09-28 ~ 10-11) 덱(Slides 아티팩트)을 만드는 스크립트다. 구성안은 상위 문서 `4-6_6주차발표_슬라이드구성.md`.

- **게시된 덱:** https://claude.ai/artifact/Tk7TD8yx1bWthxvGsVHxpQ (2026-10-11 게시, 비공개 — 공유는 소유자가 Share 메뉴에서 바꾼다)

## 폴더

| 폴더 | 내용 |
|---|---|
| `viz/` | `deck46.js`(덱 23장). 도식은 SVG 없이 카드·막대로 그려 `lib.js`·`figs`를 쓰지 않는다 |
| `screenshots/` | 덱에 넣은 캡처 5장(회원 웹 3 · 관리자 웹 2) — 2026-10-11 로컬에서 찍음 |
| `deck-out/project/` | `deck46.js` 결과(`deck.json` + `slides/*.html`). 게시본과 같은 스냅샷 |

## 다시 만들기·게시

```bash
node viz/deck46.js deck-out    # 끝에 린트(24px·<text>·SVG 52KB·요소 200개·노트 4000자)
```

게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로.

## 알려진 한계

- **캡처는 로컬 실행 화면이다**(api + admin-web + member-web, 로컬 `sports_erp_dev` DB). 배포본(Worker 재배포 전)이 아니다. Playwright로 데모 로그인 버튼을 눌러 찍었고, 회원 화면은 iPhone 13 에뮬레이션(실기기 아님), 관리자 화면은 개발용 안내 문구를 숨겼다. 홈 혼잡도는 찍기 전에 로컬 DB에서 현재 인원을 다시 입력해 갱신 시각을 맞췄다. 캡처 이미지는 아티팩트 자산(`/_blob/<id>`)이라 새 아티팩트로 옮기면 `screenshots/`에서 다시 올린다.
- 게시 후 렌더 결과를 눈으로 확인하지 않았다(4-0 §7 마지막 항목은 발표자가 확인).
- **편집기에서 직접 고친 슬라이드가 있다**(`member-flow`·`member-shot`·`perf-tradeoff`, 2026-10-12~14). `deck-out/`의 `member-flow`·`perf-tradeoff`는 게시본을 받아 온 것이고, `node viz/deck46.js deck-out`을 다시 돌리면 이 장들이 생성기 판으로 덮어써진다. 재생성 후에는 이 장을 게시하지 않거나, 게시본을 다시 받아 온다(`member-shot`은 게시본을 받아 오지 않았다).
