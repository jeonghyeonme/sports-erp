/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '(test|src)/.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  // 매 테스트 파일이 앱을 새로 띄우고 bcrypt 해시를 계산하므로 여유를 둔다.
  testTimeout: 30000,
};
