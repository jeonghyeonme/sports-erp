# 6주차 발표 덱 — 생성 소스

6주차 진행 발표(2026-09-28 ~ 10-11) 덱(Slides 아티팩트)을 만드는 스크립트다. 구성안은 상위 문서 `4-6_6주차발표_슬라이드구성.md`.

- **게시된 덱:** https://claude.ai/artifact/Tk7TD8yx1bWthxvGsVHxpQ (2026-10-11 게시, 비공개 — 공유는 소유자가 Share 메뉴에서 바꾼다)

## 폴더

| 폴더 | 내용 |
|---|---|
| `viz/` | `deck46.js`(덱 23장). 도식은 SVG 없이 카드·막대로 그려 `lib.js`·`figs`를 쓰지 않는다 |
| `deck-out/project/` | `deck46.js` 결과(`deck.json` + `slides/*.html`). 게시본과 같은 스냅샷 |

## 다시 만들기·게시

```bash
node viz/deck46.js deck-out    # 끝에 린트(24px·<text>·SVG 52KB·요소 200개·노트 4000자)
```

게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로.

## 알려진 한계

- **캡처 3장이 빈 프레임이다**(`member-shot`·`req-shot`·`rule-shot`). Worker 재배포 전이라 회원 웹·변경 이력·계약 상태 변경 화면을 찍지 못했다. 찍으면 `screenshots/`에 원본을 두고 아티팩트 자산으로 올려 교체한다.
- 게시 후 렌더 결과를 눈으로 확인하지 않았다(4-0 §7 마지막 항목은 발표자가 확인).
