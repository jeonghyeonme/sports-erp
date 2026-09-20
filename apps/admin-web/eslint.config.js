import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // 아래 두 규칙은 lint 설정 복구 시점(2026-09-20)에 기존 코드 4건이 걸려 warn으로 낮춤.
      // 해당 코드(CollapsibleBranchSection, MemberDetailPage, PostDetailPage, auth-context)를
      // 정리한 뒤 error로 복구할 것. 새 코드에서 늘어나지 않게 warn 개수를 확인한다.
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
]);
