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
- **`public/`에는 `public/assets/**`(manifest·아이콘)와 `public/sw.js`만 둔다(D45).** `/m/` 바로 아래 다른 파일은 요청마다 Worker를 거쳐 무료 한도를 쓴다(design-constants ⑬). `sw.js`는 Worker `run_worker_first`에서 예외로 뺐다.
- **service worker는 화면 파일만 캐시한다** — `/api`를 캐시하지 않는다(D45). 캐시 방식을 바꾸면 `public/sw.js`의 `CACHE` 이름을 올린다.
- **토큰**: access token은 메모리, refresh token은 localStorage(`lib/api.ts`). refresh는 1회용이라 `refreshSession()`을 거쳐 한 번만 보낸다.
- **요청 수**: 방문당 약 10회 호출을 가정했다(design-constants ⑩). 화면 하나가 API를 여러 번 부르지 않게 한다.
- **오류 문구는 `lib/errors.ts`의 표 하나**(code → message + hint). 화면은 `describeError()`만 쓰고, 결과의 "해결: …" 줄은 `.form-error`·`.error-panel p`의 `white-space: pre-line`으로 보인다(log/098). 새 오류 코드를 다루면 이 표에 함께 넣는다.
- lint 규칙과 패턴은 admin-web과 같다(`apps/admin-web/CLAUDE.md` — effect로 state 복사 금지, 훅·컴포넌트 export 분리).
