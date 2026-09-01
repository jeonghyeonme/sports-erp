# 스포이즘 ERP (포트폴리오)

아파트 커뮤니티 시설 위탁운영 기업을 가정한 다지점(멀티테넌트) 회원·인사 관리 ERP입니다.
설계 배경과 요구사항은 `docs/` 폴더의 9개 문서(00 공통설계 ~ 08 혼잡도관리)를 참고하세요.

## 구성

```
apps/
  api/          NestJS + Prisma + PostgreSQL — 백엔드 API
  admin-web/    React + Vite — 본사/지점 관리자 웹
  member-app/   React Native(Expo) — 회원용 모바일 앱 (Phase 3에서 착수)
packages/
  types/        클라이언트-서버가 공유하는 타입
docs/           설계 문서 9종
```

## 최초 셋업 (로컬 개발 환경)

이 저장소는 아직 `npm install`을 실행하지 않은 상태입니다 (개발 환경에 네트워크 제약이 있어 의존성 설치는 로컬에서 진행해주세요).

```bash
# 1. Node 20 이상 확인 (.nvmrc 참고)
node -v

# 2. 루트에서 워크스페이스 전체 설치 (admin-web, api, types 한번에)
npm install

# 3. 환경변수 파일 준비
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/admin-web/.env.example apps/admin-web/.env
# 각 .env의 비밀번호/시크릿 값은 로컬용으로 직접 채워주세요.

# 4. PostgreSQL 실행 (Docker)
npm run db:up

# 5. Prisma 클라이언트 생성 + 최초 마이그레이션
npm run prisma:generate
npm run prisma:migrate

# 6. 개발 서버 실행 (터미널 2개)
npm run dev:api     # http://localhost:3000/api/v1/health
npm run dev:web     # http://localhost:5173
```

## 개발 순서

`docs/00_공통설계서.md`의 로드맵(Phase 0~5)을 따릅니다. 현재는 **Phase 0(프로젝트 셋업)** 단계로,
인증/회원관리 등 실제 도메인 로직은 아직 없고 헬스체크(`GET /api/v1/health`)만 동작합니다.

- [x] 모노레포 구조, Git, 환경설정
- [ ] Prisma 스키마 전체 확장 (01~08 문서 기준)
- [ ] 인증(로그인/JWT/RBAC) — 01문서
- [ ] 회원관리 — 05문서
- [ ] 이하 02~04, 06~08 순차 진행
