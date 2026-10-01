# docs — 문서 지도

이 프로젝트의 문서는 **"누가, 언제 읽나"** 기준으로 나뉜다. 에이전트(Claude)와 사람이 같은 지도를 쓴다. 원칙은 세 가지다: 질문 하나에 답하는 자리는 하나, 위치가 아니라 ID로 인용, 그리고 매 세션 읽히는 문서는 작게 유지(`scripts/doc-check.mjs`가 강제). 결정 경위는 [D38](decisions/D38.md)에 있다.

## 로딩 계층

| 계층 | 언제 읽나 | 문서 |
|---|---|---|
| T0 상주 | 매 턴 | 루트 `CLAUDE.md` — 사업 구조·불변식·명령어·라우팅 표 |
| T1 조건부 | 그 폴더 파일을 다룰 때 자동 | `apps/api/CLAUDE.md`, `apps/admin-web/CLAUDE.md` |
| T2 진입점 | 세션·작업 시작 | [STATUS.md](STATUS.md), 각 도메인 문서 맨 위 **요약 카드** |
| T3 보관 | ID로 찾을 때만 | 도메인 문서 본문·부록, `decisions/D<번호>.md`, `log/NNN.md`, `architecture/` |

## 폴더

| 폴더 | 답하는 질문 | 쓰는 법 |
|---|---|---|
| [STATUS.md](STATUS.md) | 지금 어디까지 왔고 다음은 뭔가 | 세션 끝에 덮어쓴다(80줄 상한) |
| [domains/](domains/) | 이 기능은 무엇을 해야 하고 왜 이렇게 만들었나 | 도메인당 1파일: 요약 카드 → §0~12(요구사항→Driver→대안→ADR→검증) → 부록 A-3~A-9(옛 설계서 절 번호 그대로: 데이터 모델·화면·API·비즈니스 로직·권한·우선순위·테스트) |
| [architecture/](architecture/) | 도메인과 무관하게 지금 유효한 규칙은 | [entities](architecture/entities.md)(공유 엔티티 단일 진실 공급원) · [system-overview](architecture/system-overview.md) · [data-integrity](architecture/data-integrity.md) · [date-time-handling](architecture/date-time-handling.md) · [design-constants](architecture/design-constants.md) · [traffic-infra-review](architecture/traffic-infra-review.md) |
| [decisions/](decisions/README.md) | 그 횡단 규칙은 언제 왜 정했나 | 결정 하나에 파일 하나(`D37.md`). 고치지 않고 새 번호로 대체. 도메인 안의 결정은 도메인 문서 ADR |
| [process/](process/) | 일은 어떤 절차로 하나 | 방법론: RFP 분류 · 도메인 우선순위 · 도메인 사이클 템플릿 |
| [log/](log/README.md) | 과거에 무슨 일이 있었나 | 한 건에 파일 하나(`051.md`), append-only. 세션 시작 때 읽지 않는다. 트러블슈팅·끝난 과정 문서(archive/)도 여기 |
| [reference/](reference/) | 바깥에서 온 원본·사람이 판단할 때 쓰는 자료 | 원본 RFP PDF · 요구사항추적표 · 차별화전략 · 기업 구조 분석 · 시스템 비유 설명 |
| [design/](design/디자인시스템.md) | 화면은 어떤 규칙으로 그리나 | admin-web 작업 전 필독 |
| [presentation/](presentation/) | 주간 발표 | 발표 작업을 요청받았을 때만 수정 |
| [deliverables/](deliverables/) | RFP 산출물 제출본 | 자기완결형 HTML — 다른 문서와 링크로 얽지 않는다 |

## 인용 규칙

| 쓰는 형태 | 가리키는 곳 |
|---|---|
| `예약및결제 A-6` | `domains/예약및결제.md` 부록 A-6 |
| `ADR-RSV-01` | 해당 도메인 문서의 ADR 절 |
| `D37` | `decisions/D37.md` |
| `docs/log/051` | `log/051.md` |
| `entities.md §2-1` | `architecture/entities.md` §2-1 |

## 세션 루프

1. **시작**: `CLAUDE.md`(자동) → `STATUS.md` → 해당 도메인 요약 카드
2. **작업**: 근거(ADR·D 번호)를 먼저 밝히고 구현 → 테스트·lint·빌드
3. **검증**: 커밋 전 hook(코드: lint·빌드·jest / 문서: doc-check) + CI
4. **마무리**: `.claude/skills/wrap-up/SKILL.md` — STATUS 덮어쓰기, `log/NNN.md` 한 건, 필요하면 ADR·`D<번호>`·요약 카드 갱신
