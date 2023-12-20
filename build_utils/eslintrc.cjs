const isWindows = process.platform === 'win32'

module.exports = {
  env: {
    es6: true,
    jest: true,
    node: true,
  },

  extends: [
    'eslint:recommended',
    'airbnb',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:jest/recommended',
  ],

  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2022,
    sourceType: 'module',
    useJSXTextNode: true,
    project: './tsconfig.json',
  },
  plugins: ['import', 'jest', '@typescript-eslint'],
  rules: {
    'no-void': ['warn', { allowAsStatement: true }],
    'linebreak-style': ['warn', process.platform === 'win32' ? 'windows' : 'unix'],
    quotes: [
      'warn',
      'single',
      { avoidEscape: true, allowTemplateLiterals: false },
    ],
    'import/extensions': 'off',
    'dot-location': 'warn',
    'no-trailing-spaces': 'warn',
    'no-multi-spaces': 'warn',
    'no-multiple-empty-lines': 'warn',
    'space-infix-ops': 'warn',
    'object-curly-spacing': 'warn',
    'key-spacing': 'warn',
    'lines-between-class-members': [1, 'always', { exceptAfterSingleLine: true }],
    '@typescript-eslint/no-parameter-properties': [0],
    '@typescript-eslint/explicit-function-return-type': [0],
    '@typescript-eslint/explicit-member-accessibility': [0],
    indent: ['warn'],
    '@typescript-eslint/indent': 'off',
    semi: ['warn', 'never'],
    'no-param-reassign': [2, { 'props': false }],
    '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }],
    'no-constant-condition': ['warn', { checkLoops: false }],
    'generator-star-spacing': ["warn", { "before": true, "after": false }],
    'arrow-parens': ['warn', 'as-needed'],
    'comma-spacing': ['warn'],
    'comma-dangle': ['warn', {
      functions: 'ignore',
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
    }],
    'implicit-arrow-linebreak': ['off'],
    'import/prefer-default-export': ['off'],
    'object-curly-newline': ['warn', { consistent: true }],
    '@typescript-eslint/member-delimiter-style': ['warn', {
      multiline: { delimiter: 'none', requireLast: undefined },
      singleline: { delimiter: 'semi', requireLast: undefined },
    }],
    'import/no-extraneous-dependencies': ['error', {
      devDependencies: ['!test/**/*'],
    }],
    'no-shadow': ['off'],
    '@typescript-eslint/no-shadow': ['error'],
    '@typescript-eslint/ban-types': [
      'error',
      {
        'extendDefaults': true,
        'types': {
          '{}': false,
          'object': false
        }
      }
    ],
    // This rule is already enforced on all functions so no need to enforce it in addition on module boundary
    '@typescript-eslint/explicit-module-boundary-types': ['off'],
    '@typescript-eslint/return-await': ['error', 'always'],
    "no-return-await": "off",
    '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true}],
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        'checksVoidReturn': false,
      }
    ],
    'jest/valid-describe': ['off'],
    'no-restricted-imports': ['error', { patterns: ['**/dist/**', 'src/*'] }],
    // copied from https://github.com/airbnb/javascript/blob/master/packages/eslint-config-airbnb-base/rules/style.js#L334
    // removed rule about generators/iterators since es2019 natively supports them
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ],
    'no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-expressions': ['error'],
    '@typescript-eslint/await-thenable': ['error'],
    'max-len':
      [
        'warn',
        {
          'code': 120,
          'ignoreUrls': true,
          'ignoreStrings': true,
          'ignoreTemplateLiterals': true,
          'ignoreRegExpLiterals': true
        }
      ]
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-useless-constructor': [0],
        'no-empty-function': [0],
        '@typescript-eslint/array-type': [0],
        '@typescript-eslint/ban-ts-ignore': [0],
        'max-classes-per-file': [0],
        'import/no-unresolved': [0], // unable to read paths from tsconfig.json
      }
    },
  ],
  settings: {
    'import/resolver': {
      node: {
        paths: ['./'],
      },
    },
    react: {
      version: '18.2' // not using react now, set to disable warning
    }
  },
}
