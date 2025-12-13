import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'fastify', message: 'HTTP framework must stay in interfaces layer.' },
            { name: '@fastify/cors', message: 'Security plugins must stay in interfaces/infrastructure.' },
            { name: '@fastify/helmet', message: 'Security plugins must stay in interfaces/infrastructure.' },
            { name: '@fastify/rate-limit', message: 'Security plugins must stay in interfaces/infrastructure.' },
            { name: 'pino', message: 'Logging must stay in infrastructure.' }
          ]
        }
      ]
    }
  }
];
