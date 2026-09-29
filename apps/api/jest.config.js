/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '(test|src)/.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  // 매 테스트 파일이 앱을 새로 띄우고 bcrypt 해시를 계산하므로 여유를 둔다.
  testTimeout: 30000,
  // D29 — jest 워커마다 별도 DB(기준 DB를 템플릿으로 복제). test/setup/test-db.ts 참고.
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
  setupFiles: ['<rootDir>/test/setup/worker-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup/after-env.ts'],
};
