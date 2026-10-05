# 종합 발표 덱 — 생성 소스

종합 발표 덱(Slides 아티팩트)을 만드는 스크립트와 캡처를 보관한다. 구성안은 상위 문서 `4-5_종합발표_슬라이드구성.md`.

- **게시된 덱:** https://claude.ai/artifact/M6jdRHTH54pfGy884PiyxG (2026-10-05 게시, 비공개 — 공유는 소유자가 Share 메뉴에서 바꾼다)

## 폴더

| 폴더 | 내용 |
|---|---|
| `viz/` | `deck45.js`(덱 39장), `figs-45.js`(도식 8개), `lib.js`(4주차 그대로 복사한 도식 공용 코드) |
| `screenshots/` | 덱에 넣은 캡처 2장 — 3주차(2026-09-21) 캡처를 재사용했다. 새로 찍지 않았다 |
| `deck-out/project/` | `deck45.js` 결과(`deck.json` + `slides/*.html`). 게시본과 같은 스냅샷 |

## 다시 만들기·게시

```bash
node viz/deck45.js deck-out    # deck-out/project/ 아래를 다시 쓴다. 끝에 린트(24px·<text>·SVG 52KB·요소 200개·노트 4000자)
```

- 캡처 이미지는 아티팩트 자산(`/_blob/<id>`)으로 올려 `deck45.js`의 `IMG`에 적었다. 이 주소는 위 아티팩트에 묶여 있어 새 아티팩트로 옮기면 `screenshots/`에서 다시 올려야 한다.
- 게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로.

## 알려진 한계

- 게시 후 렌더 결과를 눈으로 확인하지 않았다(4-0 §7 마지막 확인 항목은 발표자가 덱을 열어 확인).
- 캡처는 실DB 전환 이전 화면이다. 두 화면 구성은 이후 바뀌지 않았지만 데이터는 mock 시절 값이다.
