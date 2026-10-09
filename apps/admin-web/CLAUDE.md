# apps/admin-web — 작업 규칙

> `apps/admin-web/` 파일을 다룰 때만 로드된다. 화면 작업 전에 [docs/design/디자인시스템.md](../../docs/design/디자인시스템.md)를 먼저 읽는다.

## 명령어 (apps/admin-web 안에서)

```bash
npm run lint    # eslint .
npm run build   # tsc -b && vite build
```

테스트가 없다 — 검증은 lint + 빌드(타입체크)뿐이므로 동작은 "검증되지 않음"으로 보고한다.

## lint는 규칙 예외가 없다 (2026-09-21 부채 정리 완료)

`react-hooks/set-state-in-effect`·`react-refresh/only-export-components`를 포함해 기본 severity 그대로이고 경고 0건이다. 새 경고를 만들지 말고 규칙을 낮춰서 통과시키지 말 것. 이 규칙 때문에 지킬 패턴:

1. **prop·조회 데이터를 effect로 state에 복사하지 않는다.** 편집 폼은 "편집 시작" 클릭 시점에 채우고, prop 변경에 따른 state 보정은 렌더 중 이전 값 비교로 한다(`CollapsibleBranchSection`, `MemberDetailPage` 참고).
2. **컴포넌트 파일에서 훅·상수를 함께 export하지 않는다** — `useAuth`·`AuthContext`는 `lib/use-auth.ts`, `AuthProvider`는 `lib/auth-context.tsx`에 있다.

## 화면이 API를 못 따라간 곳이 있다

"API가 있으니 화면도 있다"고 가정하지 말 것. 예: 근태의 결근 확정, 자산 정보 수정은 API만 있다(인사 채용·파견·퇴사와 비밀번호 변경 화면도 2026-10-09 전까지 그랬다, log/090·091). 화면별 현황은 각 도메인 문서 부록 A-4(화면 목록)를 본다.
