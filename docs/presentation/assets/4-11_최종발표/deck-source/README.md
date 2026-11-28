# 최종 발표 덱 — 생성 소스

구성안은 상위 문서 `4-11_최종발표_슬라이드구성.md`.

- **게시된 덱:** https://claude.ai/artifact/DHahy8x9CNFNsGn5m8qMhB (비공개 — 공유는 소유자가 Share 메뉴에서). 2026-11-28 1차본 12장(구성안 15장 중 검증·AI·배운 것 일단 제외, log/252).

```bash
cd docs/presentation/assets/4-11_최종발표/deck-source
python3 viz/deck411.py deck-out   # deck-out/project/{deck.json, deck.css, slides/*.html}
```

게시: `root`=`deck-out`, `file_path`=`project/deck.json`(순서·섹션을 바꿀 때만), 바뀐 슬라이드만 `files`로. 사용자가 편집기에서 고친 장이 있으면 게시된 파일을 먼저 읽고 그 위에 고친다. 공통 부품(색·머리말·카드)은 13주차 `deck410.py`와 같고, 부하 장 숫자는 13주차 `data/loadtest.json`을 읽는다. `deck-out/dots.svg`는 13주차 표지 점 격자 복사본.
