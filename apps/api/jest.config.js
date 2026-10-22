/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '(test|src)/.*\\.spec\\.ts$',
  // D37 — Lambda 배포 묶음(scripts/package-lambda.sh 결과)은 테스트·모듈 탐색 대상이 아니다.
  modulePathIgnorePatterns: ['<rootDir>/.lambda/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    // D62 — sanitize-html의 HTML 파서(htmlparser2 12 계열)는 ESM 전용이다. 런타임(Node 22 require(esm))은 그대로 읽지만
    // jest는 CommonJS로 바꿔야 읽는다 — 이 패키지들만 ts-jest로 변환한다.
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true }, isolatedModules: true }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(htmlparser2|domhandler|domutils|dom-serializer|entities|domelementtype)/)'],
  // 매 테스트 파일이 앱을 새로 띄우고 bcrypt 해시를 계산하므로 여유를 둔다.
  testTimeout: 30000,
  // D29 — jest 워커마다 별도 DB(기준 DB를 템플릿으로 복제). test/setup/test-db.ts 참고.
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
  setupFiles: ['<rootDir>/test/setup/worker-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup/after-env.ts'],
};
