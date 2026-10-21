# apps/admin-web — 작업 규칙

> `apps/admin-web/` 파일을 다룰 때만 로드된다. 화면 작업 전에 [docs/design/디자인시스템.md](../../docs/design/디자인시스템.md)를 먼저 읽는다.

## 명령어 (apps/admin-web 안에서)

```bash
npm run lint    # eslint .
npm run build   # tsc -b && vite build
```

단위 테스트는 없다. 역할별 핵심 경로(본사 대시보드·지점 상세, 회원 등록·검색, 회차 등록, 공지·첨부, 근태 출근·휴가 승인, 세부 권한 변경·화면 숨김, 처리 대기함)만 루트 `e2e/`의 화면 자동 테스트(D59, CI)가 본다 — 그 밖의 화면 동작은 "검증되지 않음"으로 보고한다. 화면 문구·구조를 바꾸면 `npm run e2e`(api 빌드·`build:web` 먼저)로 확인한다.

## lint는 규칙 예외가 없다 (2026-09-21 부채 정리 완료)

`react-hooks/set-state-in-effect`·`react-refresh/only-export-components`를 포함해 기본 severity 그대로이고 경고 0건이다. 새 경고를 만들지 말고 규칙을 낮춰서 통과시키지 말 것. 이 규칙 때문에 지킬 패턴:

1. **prop·조회 데이터를 effect로 state에 복사하지 않는다.** 편집 폼은 "편집 시작" 클릭 시점에 채우고, prop 변경에 따른 state 보정은 렌더 중 이전 값 비교로 한다(`CollapsibleBranchSection`, `MemberDetailPage` 참고).
2. **컴포넌트 파일에서 훅·상수를 함께 export하지 않는다** — `useAuth`·`AuthContext`는 `lib/use-auth.ts`, `AuthProvider`는 `lib/auth-context.tsx`에 있다.

## 세부 권한 숨김(D60)

지점 관리자·직원이 쓰는 등록·수정·삭제·CSV 버튼과 메뉴는 `useCan()`(`lib/use-can.ts`)으로 권한이 꺼지면 숨긴다 — 새 버튼을 만들면 api 라우트의 `@Permission(feature, action)`과 같은 칸으로 감싼다. 판정은 서버가 하므로 숨김은 편의다. CSV는 `ExportCsvButton`에 `feature`를 주고 목록 API에 `export=true`를 붙인다. 관리자 웹에는 Prettier 설정이 없다 — 서식 도구를 돌리지 말 것(log/148).

## 화면이 API를 못 따라간 곳이 있다

"API가 있으니 화면도 있다"고 가정하지 말 것. 인사·비밀번호·가입·결근 확정·자산 수정·업무일지 열람 화면이 모두 API보다 늦게 생겼다. 화면별 현황은 각 도메인 문서 부록 A-4(화면 목록)를 본다.
