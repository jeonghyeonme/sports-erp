-- 보안-6(log/164) — 채용 때 발급한 임시 비밀번호를 바꿔야 하는 계정. 기존 계정은 false(영향 없음).
ALTER TABLE "Account" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
