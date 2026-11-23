# 13주차 발표 덱 — 생성 소스 (준비 중)

구성안은 상위 문서 `4-10_13주차발표_슬라이드구성.md`(최종안, 2026-11-23).

- **게시된 덱:** https://claude.ai/artifact/SsVt82tXqZVNUrigqD5WuG (비공개 — 공유는 소유자가 Share 메뉴에서). 2026-11-23 19장 게시(구성안 18장 + 감사합니다).

```bash
cd docs/presentation/assets/4-10_13주차발표/deck-source
python3 viz/deck410.py deck-out   # deck-out/project/{deck.json, deck.css, slides/*.html}
```

게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로. 캡처는 아티팩트 자산(`/_blob/<id>`) — 주소는 `assets.json`(키 → 올린 주소). 다시 올리면 `assets.json`을 고친다. 생성기의 공통 부품(색·머리말·카드·브라우저 프레임)은 12주차 `deck49.py`와 같다. 부하 장의 숫자는 `data/loadtest.json`에서 읽는다.

## screenshots/

로컬 시연 데이터(2026-11-23 기준) 캡처 — 파일·슬라이드·계정 표는 구성안 "캡처 목록과 계정". 게시글 작성 수정 전 캡처는 다시 찍어야 한다.

## data/

| 파일 | 내용 |
|---|---|
| `loadtest.json` | 부하 장에 쓸 숫자 — 타임라인 구간, 10월(D50)·이번(current·legacy) 결과, 통과 기준. 생성기는 이 파일을 읽는다 |
| `k6-2026-11-22-current.txt` | 운영 Lambda k6 요약 출력(조회 8종) — 사용자 PC, 원본 |
| `k6-2026-11-22-legacy.txt` | 같은 측정, 10월과 같은 조회 4종 |

숫자의 해석과 계산 방법(과부하 실제 처리량 역산)은 진행 기록 log/239에 있다. 덱을 만들 때는 12주차 생성기(`../../4-9_12주차발표/deck-source/viz/deck49.py`)의 공통 부품(색·머리말·카드)을 그대로 쓴다.
