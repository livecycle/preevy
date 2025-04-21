const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const stylistic = require('@stylistic/eslint-plugin')
const stylisticTs = require('@stylistic/eslint-plugin-ts')
const importPlugin = require('eslint-plugin-import')
const jestPlugin = require('eslint-plugin-jest')

module.exports = [
  {
    ignores: [
      'dist/**',
      'build.mjs',
    ],
  },

  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
      },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    plugins: {
      import: importPlugin,
      jest: jestPlugin,
      '@typescript-eslint': tsPlugin,
      '@stylistic': stylistic,
      '@stylistic/ts': stylisticTs,
    },
    settings: {
      'import/resolver': { node: { paths: ['./'] } },
      react: { version: '18.2' },
    },
    rules: {
      // — non‑style rules —
      'no-void': ['warn', { allowAsStatement: true }],
      'no-param-reassign': ['error', { props: false }],
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-restricted-imports': ['error', { patterns: ['**/dist/**', 'src/*'] }],
      'no-unused-expressions': 'off',
      'no-return-await': 'off',
      'import/no-extraneous-dependencies': ['error', { devDependencies: ['!test/**/*'] }],
      'max-len': [
        'warn', { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true },
      ],
      // — style rules via @stylistic —
      '@stylistic/quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: false }],
      '@stylistic/indent': ['warn', 2],
      '@stylistic/semi': ['warn', 'never'],
      '@stylistic/comma-dangle': ['warn', { functions: 'ignore', arrays: 'always-multiline', objects: 'always-multiline', imports: 'always-multiline', exports: 'always-multiline' }],
      '@stylistic/dot-location': ['warn', 'property'],
      '@stylistic/no-trailing-spaces': 'warn',
      '@stylistic/no-multi-spaces': 'warn',
      '@stylistic/no-multiple-empty-lines': 'warn',
      '@stylistic/space-infix-ops': 'warn',
      '@stylistic/object-curly-spacing': ['warn', 'always'],
      '@stylistic/key-spacing': 'warn',
      '@stylistic/lines-between-class-members': ['warn', 'always', { exceptAfterSingleLine: true }],
      '@stylistic/generator-star-spacing': ['warn', { before: true, after: false }],
      '@stylistic/arrow-parens': ['warn', 'as-needed'],
      '@stylistic/comma-spacing': 'warn',
      '@stylistic/object-curly-newline': ['warn', { consistent: true }],
      '@stylistic/ts/member-delimiter-style': ['warn', { multiline: { delimiter: 'none', requireLast: undefined }, singleline: { delimiter: 'semi', requireLast: undefined } }],
      indent: 'off',
      '@typescript-eslint/indent': 'off',
    },
  },

  {
    files: ['*.ts', '*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
    },
    rules: {
      'no-useless-constructor': 'off',
      'no-empty-function': 'off',
      '@stylistic/ts/array-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'max-classes-per-file': 'off',
      'import/no-unresolved': 'off',

      '@typescript-eslint/no-unused-expressions': ['error'],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/return-await': ['error', 'always'],
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/no-parameter-properties': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
]
