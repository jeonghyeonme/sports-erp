-- D28 DI-02 후속 — Supabase 보안 어드바이저 function_search_path_mutable(WARN) 대응.
-- 트리거 함수가 호출자의 search_path를 따르면, 검색 경로를 조작해 함수 안의 "Staff"·"Member" 등이 다른 스키마의
-- 같은 이름 객체를 가리키게 만들 수 있다. 함수마다 search_path를 public으로 고정한다(pg_temp는 마지막 — 임시 객체 우선 해석 차단).
ALTER FUNCTION "program_branch_consistency"() SET search_path = public, pg_temp;
ALTER FUNCTION "member_assigned_staff_branch"() SET search_path = public, pg_temp;
ALTER FUNCTION "member_program_branch"() SET search_path = public, pg_temp;
ALTER FUNCTION "reservation_branch"() SET search_path = public, pg_temp;
ALTER FUNCTION "instructor_staff_branch"() SET search_path = public, pg_temp;
ALTER FUNCTION "staff_branch_move"() SET search_path = public, pg_temp;
