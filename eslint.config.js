import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'release/**', 'doc/**', '.codegraph/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    // Root-level config/tooling scripts: lint as plain (untyped) TS/JS, no
    // type-aware rules since they aren't part of any tsconfig "include".
    files: ['*.{js,mjs,cjs,ts}', 'scripts/**/*.{js,mjs,cjs,ts}', '.claude/skills/**/*.{js,mjs,cjs,ts}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Agent driver scripts embed literal callback strings that Playwright
    // runs inside the Electron renderer (page.evaluate), not in this file's
    // own Node process — those callbacks reference browser globals.
    files: ['.claude/skills/**/driver.mjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    // Application source: full type-aware linting.
    files: ['src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  eslintConfigPrettier,
);
