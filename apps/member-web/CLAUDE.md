# apps/member-web — 작업 규칙

> `apps/member-web/` 파일을 다룰 때만 로드된다. 회원 모바일 웹(D40·D41). 화면 작업 전에 [디자인시스템](../../docs/design/디자인시스템.md)을 먼저 읽는다. 기준 폭은 360px이다.

## 명령어 (apps/member-web 안에서)

```bash
npm run dev     # localhost:5174/m/ — /api는 vite 프록시가 localhost:3000으로 넘긴다
npm run lint    # eslint .
npm run build   # tsc -b && vite build → ../admin-web/dist/m
```

테스트가 없다. 검증은 lint + 빌드(타입체크)와 360px 스크린샷뿐이므로 동작은 "검증되지 않음"으로 보고한다.

## 지킬 것 (D41)

- **빌드 순서**: admin-web을 먼저 빌드한다(그 빌드가 `dist`를 비운다). 루트 `npm run build:web`이 순서를 지킨다.
- **`public/` 파일을 두지 않는다.** `/m/` 바로 아래 파일은 요청마다 Worker를 거쳐 무료 한도를 쓴다(design-constants ⑬).
- **토큰**: access token은 메모리, refresh token은 localStorage(`lib/api.ts`). refresh는 1회용이라 `refreshSession()`을 거쳐 한 번만 보낸다.
- **요청 수**: 방문당 약 10회 호출을 가정했다(design-constants ⑩). 화면 하나가 API를 여러 번 부르지 않게 한다.
- lint 규칙과 패턴은 admin-web과 같다(`apps/admin-web/CLAUDE.md` — effect로 state 복사 금지, 훅·컴포넌트 export 분리).
