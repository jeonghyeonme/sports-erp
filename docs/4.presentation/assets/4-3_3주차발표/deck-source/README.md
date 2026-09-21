# 3주차 발표 덱 — 생성 소스

3주차 진행상황 발표 덱(Slides 아티팩트)을 만드는 스크립트와 원본 캡처를 보관한다. 다른 컴퓨터에서 이어서 작업하기 위한 폴더다.

- **게시된 덱:** https://claude.ai/artifact/GBiFad42sswiYAs82BUqLU (claude.ai 계정 소유. 공유 설정은 소유자가 바꾸며 2026-09-21 기준 링크 공개). 이 저장소에는 덱 자체가 아니라 덱을 만드는 소스가 있다.
- 슬라이드 구성안은 상위 문서 `4-3_3주차발표_슬라이드구성.md`를 본다. 구성안은 현재 덱(RFP 산출물 3종 + 도메인 9개, 도메인마다 도식 1장 + 구현 화면 1~2장)에 맞춰 갱신돼 있다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `viz/` | 덱 생성기. `deck4.js`가 현재 덱(29장), `figs-d.js`가 도메인 도식 9개, `lib.js`가 도식 그리기 공용 코드. `figs-a/b/c.js`·`build.js`는 상위 폴더의 SVG 9개를 만든 이전 도식 코드 |
| `capture/` | 실행 중인 admin-web을 캡처하는 puppeteer 스크립트 (`capture1~3.js`) |
| `screenshots/` | 덱에 넣은 admin-web 캡처 PNG (mock 데이터 화면) |
| `deck-out/project/` | `deck4.js`가 만든 결과(`deck.json` + `slides/*.html`). 게시본과 동일한 스냅샷 |

## 덱 다시 만들기

```bash
cd viz
node deck4.js ../deck-out        # deck-out/project/ 아래에 deck.json과 slides/*.html을 다시 씀
```

의존성은 없다(Node 내장 모듈만 사용). 끝에 린트(글자 24px 이상, `<text>` 금지, SVG 52KB 이하)가 돌고 문제가 있으면 출력한다.

## 아티팩트에 게시하기

Claude에게 "이 폴더의 `deck-out/project/deck.json`과 `slides/`를 위 아티팩트 URL에 게시해줘"라고 하면 된다. 알아둘 점:

- 게시는 Slides 아티팩트 형식(1920×1080, 슬라이드당 HTML 1개 + `deck.json`)이다. 슬라이드 파일이 바뀐 것만 `files`로 보내면 된다.
- **이미지는 아티팩트 자산으로 올라가 있다.** `deck4.js`의 `SHOTS`와 `IMG51`/`IMG52`에 적힌 `/_blob/<id>`는 이 아티팩트에 묶인 값이라, 다른 아티팩트로 옮기면 `screenshots/`의 PNG를 다시 올려 id를 바꿔야 한다. `IMG51`/`IMG52`(5-1·5-2 문서 화면)의 원본 PNG는 이 폴더에 없다 — `docs/5.deliverables/`의 HTML을 브라우저로 열어 다시 캡처해야 한다.
- Windows에서는 8.3 짧은 경로(`AGUMON~1` 등)가 막히는 경우가 있으니 긴 경로를 쓴다.

## 화면 다시 캡처하기

캡처는 **로그인된 Chrome 창에 붙어서** 한다. 계정 로그인은 사람이 직접 해야 한다(데모 계정 카드 클릭). 토큰이 메모리에만 있어 새로고침하면 로그아웃되므로, 스크립트는 사이드바 링크 클릭으로만 이동한다.

1. API와 admin-web을 띄운다 (`npm run dev:api`, `npm run dev:web`).
2. 원격 디버깅을 켠 Chrome을 연다: `chrome --remote-debugging-port=9333 --user-data-dir=<임시폴더> http://localhost:5173`
3. 그 창에서 데모 계정으로 로그인한다. 덱에 쓴 계정은 세 가지다.
   - 지점 관리자 김민수(서초점) — 근태·회원·프로그램·게시판·시설·자산·문서함
   - 본사 관리자 정하늘 — 권한 관리, 지점 상세
   - 회원 이수진(서초점) — 예약·결제 흐름
4. `cd capture && npm install && node capture1.js` (계정에 맞는 스크립트를 실행). 결과는 `screenshots/`에 저장된다.

`capture2.js`는 mock 데이터를 실제로 바꾼다(권한 전환, 직원 채용·재배치). 인메모리 상태라 API를 재시작하면 원래대로 돌아간다. 프로그램 상태를 바꾼 뒤에는 회차 예약이 안 보일 수 있으니 재시작한 다음 캡처한다.

## 알려진 한계

- admin-web에는 채용·재배치 화면이 없다(API만 구현). 인사정보관리 구현 화면 슬라이드는 지점 상세의 계약 정보·파견 직원 목록을 쓰고, 채용·재배치는 "API로 구현, 화면은 후속 과제"라고 명시했다.
- 슬라이드 렌더러 없이는 결과를 로컬에서 그대로 볼 수 없다. 게시 후 아티팩트에서 확인한다.
