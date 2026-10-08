// 혼잡도관리 A-6 — 이용률 5단계 이름(0~20 / 21~40 / 41~60 / 61~80 / 81%~).
export const LEVEL_LABELS = ['', '여유', '보통', '약간 붐빔', '붐빔', '매우 붐빔'] as const;

// ADR-FAC-04 — 자동 폴링 없이 화면 진입과 수동 새로고침만. 새로고침은 이 간격 안에 다시 누를 수 없다(B1-3 사용자 결정 30초).
export const REFRESH_COOLDOWN_MS = 30_000;

// B1-4 사용자 결정(log/085) — 홈 카드(혼잡도·최근 공지)는 같은 방문 안에서 60초 안에 홈으로 돌아오면 다시 부르지 않는다
// (design-constants ⑩). 새로고침 버튼은 캐시를 건너뛴다.
export const HOME_CARD_CACHE_MS = 60_000;
