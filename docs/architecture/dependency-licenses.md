# 운영 의존성 라이선스 목록

> `node scripts/license-report.mjs`가 만든 파일이다 — 손으로 고치지 않는다. 의존성을 바꾸면 다시 실행한다(`--check`는 허용형 밖이 있으면 실패).
> RFP 규정의준수(1-2 #10) 대응. 판정 기준과 경위는 [요구사항추적표](../reference/요구사항추적표.md) §3-2 N10, log/139.

## 요약

- 대상: 운영 의존성(`npm query ".prod"` — 개발·빌드 도구 제외) **219개**. 관리자 웹·회원 웹 번들과 api(Lambda) 묶음에 들어가는 것이다.
- 허용형 라이선스(MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, Unlicense, CC0-1.0) 밖: **0건**.
- GPL·AGPL·LGPL 같은 상호주의(copyleft) 라이선스는 없다. 허용형 라이선스의 의무는 저작권·라이선스 고지 유지뿐이고, 배포 묶음(node_modules·번들)에 각 패키지의 LICENSE가 그대로 들어간다.
- 프로젝트 자체 코드·문서·이미지는 직접 작성했다(외부 이미지·폰트·아이콘 파일을 저장소에 넣지 않았다 — 회원 웹 아이콘은 자체 제작, 글꼴은 시스템 글꼴).

| 라이선스 | 개수 |
|---|---|
| MIT | 169 |
| ISC | 30 |
| Apache-2.0 | 12 |
| BSD-3-Clause | 4 |
| BSD-2-Clause | 3 |
| 0BSD | 1 |

## 전체 목록

라이선스를 package.json `license`가 아닌 곳에서 읽은 것은 "출처"에 적는다.

| 패키지 | 버전 | 라이선스 | 출처 |
|---|---|---|---|
| @borewit/text-codec | 0.2.2 | MIT |  |
| @codegenie/serverless-express | 4.17.1 | Apache-2.0 |  |
| @lukeed/csprng | 1.1.0 | MIT |  |
| @mapbox/node-pre-gyp | 1.0.11 | BSD-3-Clause |  |
| @nestjs/common | 10.4.22 | MIT |  |
| @nestjs/config | 3.3.0 | MIT |  |
| @nestjs/core | 10.4.22 | MIT |  |
| @nestjs/jwt | 10.2.0 | MIT |  |
| @nestjs/passport | 10.0.3 | MIT |  |
| @nestjs/platform-express | 10.4.22 | MIT |  |
| @nuxtjs/opencollective | 0.3.2 | MIT |  |
| @prisma/client | 5.22.0 | Apache-2.0 |  |
| @prisma/debug | 5.22.0 | Apache-2.0 |  |
| @prisma/engines | 5.22.0 | Apache-2.0 |  |
| @prisma/engines-version | 5.22.0-44.605197351a3c8bdd595af2d2a9bc3025bca48ea2 | Apache-2.0 |  |
| @prisma/fetch-engine | 5.22.0 | Apache-2.0 |  |
| @prisma/get-platform | 5.22.0 | Apache-2.0 |  |
| @remix-run/router | 1.23.4 | MIT |  |
| @tanstack/query-core | 5.102.8 | MIT |  |
| @tanstack/react-query | 5.102.8 | MIT |  |
| @tokenizer/inflate | 0.2.7 | MIT |  |
| @tokenizer/token | 0.3.0 | MIT |  |
| @types/jsonwebtoken | 9.0.5 | MIT |  |
| @types/node | 20.19.43 | MIT |  |
| @types/validator | 13.15.10 | MIT |  |
| abbrev | 1.1.1 | ISC |  |
| accepts | 1.3.8 | MIT |  |
| agent-base | 6.0.2 | MIT |  |
| ansi-regex | 5.0.1 | MIT |  |
| ansi-styles | 4.3.0 | MIT |  |
| append-field | 1.0.0 | MIT |  |
| aproba | 2.1.0 | ISC |  |
| are-we-there-yet | 2.0.0 | ISC |  |
| array-flatten | 1.1.1 | MIT |  |
| asynckit | 0.4.0 | MIT |  |
| axios | 1.20.0 | MIT |  |
| balanced-match | 1.0.2 | MIT |  |
| bcrypt | 5.1.1 | MIT |  |
| body-parser | 1.20.4 | MIT |  |
| brace-expansion | 1.1.18 | MIT |  |
| buffer-equal-constant-time | 1.0.1 | BSD-3-Clause |  |
| buffer-from | 1.1.2 | MIT |  |
| busboy | 1.6.0 | MIT | package.json(licenses) |
| bytes | 3.1.2 | MIT |  |
| call-bind-apply-helpers | 1.0.2 | MIT |  |
| call-bound | 1.0.4 | MIT |  |
| chalk | 4.1.2 | MIT |  |
| chownr | 2.0.0 | ISC |  |
| class-transformer | 0.5.1 | MIT |  |
| class-validator | 0.14.4 | MIT |  |
| color-convert | 2.0.1 | MIT |  |
| color-name | 1.1.4 | MIT |  |
| color-support | 1.1.3 | ISC |  |
| combined-stream | 1.0.8 | MIT |  |
| concat-map | 0.0.1 | MIT |  |
| concat-stream | 2.0.0 | MIT |  |
| consola | 2.15.3 | MIT |  |
| console-control-strings | 1.1.0 | ISC |  |
| content-disposition | 0.5.4 | MIT |  |
| content-type | 1.0.5 | MIT |  |
| cookie | 0.7.2 | MIT |  |
| cookie-signature | 1.0.7 | MIT |  |
| cors | 2.8.5 | MIT |  |
| debug | 2.6.9 | MIT |  |
| debug | 4.4.3 | MIT |  |
| delayed-stream | 1.0.0 | MIT |  |
| delegates | 1.0.0 | MIT |  |
| depd | 2.0.0 | MIT |  |
| destroy | 1.2.0 | MIT |  |
| detect-libc | 2.1.2 | Apache-2.0 |  |
| dotenv | 16.4.5 | BSD-2-Clause |  |
| dotenv-expand | 10.0.0 | BSD-2-Clause |  |
| dunder-proto | 1.0.1 | MIT |  |
| ecdsa-sig-formatter | 1.0.11 | Apache-2.0 |  |
| ee-first | 1.1.1 | MIT |  |
| emoji-regex | 8.0.0 | MIT |  |
| encodeurl | 2.0.0 | MIT |  |
| es-define-property | 1.0.1 | MIT |  |
| es-errors | 1.3.0 | MIT |  |
| es-object-atoms | 1.1.2 | MIT |  |
| es-set-tostringtag | 2.1.0 | MIT |  |
| escape-html | 1.0.3 | MIT |  |
| etag | 1.8.1 | MIT |  |
| express | 4.22.1 | MIT |  |
| fast-safe-stringify | 2.1.1 | MIT |  |
| fflate | 0.8.3 | MIT |  |
| file-type | 20.4.1 | MIT |  |
| finalhandler | 1.3.2 | MIT |  |
| follow-redirects | 1.16.0 | MIT |  |
| form-data | 4.0.6 | MIT |  |
| forwarded | 0.2.0 | MIT |  |
| fresh | 0.5.2 | MIT |  |
| fs-minipass | 2.1.0 | ISC |  |
| fs.realpath | 1.0.0 | ISC |  |
| function-bind | 1.1.2 | MIT |  |
| gauge | 3.0.2 | ISC |  |
| get-intrinsic | 1.3.0 | MIT |  |
| get-proto | 1.0.1 | MIT |  |
| glob | 7.2.3 | ISC |  |
| gopd | 1.2.0 | MIT |  |
| has-flag | 4.0.0 | MIT |  |
| has-symbols | 1.1.0 | MIT |  |
| has-tostringtag | 1.0.2 | MIT |  |
| has-unicode | 2.0.1 | ISC |  |
| hasown | 2.0.4 | MIT |  |
| http-errors | 2.0.1 | MIT |  |
| https-proxy-agent | 5.0.1 | MIT |  |
| iconv-lite | 0.4.24 | MIT |  |
| ieee754 | 1.2.1 | BSD-3-Clause |  |
| inflight | 1.0.6 | ISC |  |
| inherits | 2.0.4 | ISC |  |
| ipaddr.js | 1.9.1 | MIT |  |
| is-fullwidth-code-point | 3.0.0 | MIT |  |
| iterare | 1.2.1 | ISC |  |
| js-tokens | 4.0.0 | MIT |  |
| jsonwebtoken | 9.0.2 | MIT |  |
| jwa | 1.4.2 | MIT |  |
| jws | 3.2.3 | MIT |  |
| libphonenumber-js | 1.13.12 | MIT |  |
| lodash | 4.17.21 | MIT |  |
| lodash.includes | 4.3.0 | MIT |  |
| lodash.isboolean | 3.0.3 | MIT |  |
| lodash.isinteger | 4.0.4 | MIT |  |
| lodash.isnumber | 3.0.3 | MIT |  |
| lodash.isplainobject | 4.0.6 | MIT |  |
| lodash.isstring | 4.0.1 | MIT |  |
| lodash.once | 4.1.1 | MIT |  |
| loose-envify | 1.4.0 | MIT |  |
| make-dir | 3.1.0 | MIT |  |
| math-intrinsics | 1.1.0 | MIT |  |
| media-typer | 0.3.0 | MIT |  |
| merge-descriptors | 1.0.3 | MIT |  |
| methods | 1.1.2 | MIT |  |
| mime | 1.6.0 | MIT |  |
| mime-db | 1.52.0 | MIT |  |
| mime-types | 2.1.35 | MIT |  |
| minimatch | 3.1.5 | ISC |  |
| minimist | 1.2.8 | MIT |  |
| minipass | 3.3.6 | ISC |  |
| minipass | 5.0.0 | ISC |  |
| minizlib | 2.1.2 | MIT |  |
| mkdirp | 0.5.6 | MIT |  |
| mkdirp | 1.0.4 | MIT |  |
| ms | 2.0.0 | MIT |  |
| ms | 2.1.3 | MIT |  |
| multer | 2.0.2 | MIT |  |
| negotiator | 0.6.3 | MIT |  |
| node-addon-api | 5.1.0 | MIT |  |
| node-fetch | 2.7.0 | MIT |  |
| nopt | 5.0.0 | ISC |  |
| npmlog | 5.0.1 | ISC |  |
| object-assign | 4.1.1 | MIT |  |
| object-inspect | 1.13.4 | MIT |  |
| on-finished | 2.4.1 | MIT |  |
| once | 1.4.0 | ISC |  |
| parseurl | 1.3.3 | MIT |  |
| passport | 0.7.0 | MIT |  |
| passport-jwt | 4.0.1 | MIT |  |
| passport-strategy | 1.0.0 | MIT | package.json(licenses) |
| path-is-absolute | 1.0.1 | MIT |  |
| path-to-regexp | 0.1.13 | MIT |  |
| path-to-regexp | 3.3.0 | MIT |  |
| pause | 0.0.1 | MIT | LICENSE·README 본문 |
| prisma | 5.22.0 | Apache-2.0 |  |
| proxy-addr | 2.0.7 | MIT |  |
| proxy-from-env | 2.1.0 | MIT |  |
| qs | 6.14.2 | BSD-3-Clause |  |
| range-parser | 1.2.1 | MIT |  |
| raw-body | 2.5.3 | MIT |  |
| react | 18.3.1 | MIT |  |
| react-dom | 18.3.1 | MIT |  |
| react-router | 6.30.6 | MIT |  |
| react-router-dom | 6.30.6 | MIT |  |
| readable-stream | 3.6.2 | MIT |  |
| reflect-metadata | 0.2.2 | Apache-2.0 |  |
| rimraf | 3.0.2 | ISC |  |
| rxjs | 7.8.2 | Apache-2.0 |  |
| safe-buffer | 5.2.1 | MIT |  |
| safer-buffer | 2.1.2 | MIT |  |
| scheduler | 0.23.2 | MIT |  |
| semver | 7.8.5 | ISC |  |
| semver | 6.3.1 | ISC |  |
| send | 0.19.2 | MIT |  |
| serve-static | 1.16.3 | MIT |  |
| set-blocking | 2.0.0 | ISC |  |
| setprototypeof | 1.2.0 | ISC |  |
| side-channel | 1.1.1 | MIT |  |
| side-channel-list | 1.0.1 | MIT |  |
| side-channel-map | 1.0.1 | MIT |  |
| side-channel-weakmap | 1.0.2 | MIT |  |
| signal-exit | 3.0.7 | ISC |  |
| statuses | 2.0.2 | MIT |  |
| streamsearch | 1.1.0 | MIT | package.json(licenses) |
| string_decoder | 1.3.0 | MIT |  |
| string-width | 4.2.3 | MIT |  |
| strip-ansi | 6.0.1 | MIT |  |
| strtok3 | 10.3.5 | MIT |  |
| supports-color | 7.2.0 | MIT |  |
| tar | 6.2.1 | ISC |  |
| toidentifier | 1.0.1 | MIT |  |
| token-types | 6.1.2 | MIT |  |
| tr46 | 0.0.3 | MIT |  |
| tslib | 2.8.1 | 0BSD |  |
| type-is | 1.6.18 | MIT |  |
| typedarray | 0.0.6 | MIT |  |
| uid | 2.0.2 | MIT |  |
| uint8array-extras | 1.5.0 | MIT |  |
| undici-types | 6.21.0 | MIT |  |
| unpipe | 1.0.0 | MIT |  |
| util-deprecate | 1.0.2 | MIT |  |
| utils-merge | 1.0.1 | MIT |  |
| validator | 13.15.35 | MIT |  |
| vary | 1.1.2 | MIT |  |
| webidl-conversions | 3.0.1 | BSD-2-Clause |  |
| whatwg-url | 5.0.0 | MIT |  |
| wide-align | 1.1.5 | ISC |  |
| wrappy | 1.0.2 | ISC |  |
| xtend | 4.0.2 | MIT |  |
| yallist | 4.0.0 | ISC |  |
