import antfu from '@antfu/eslint-config'

export default antfu(
  {
    pnpm: true,
    typescript: true,
    rules: {
      'node/prefer-global/buffer': 'off',
      'node/prefer-global/process': 'off',
      'node/prefer-global/global': 'off',
    },
  },
  {
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@local-service/*', '@local-wrapper/*'],
              message: 'Packages cannot import from services or AWS wrappers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@local-wrapper/*'],
              message: 'Services cannot import from AWS wrappers.',
            },
          ],
        },
      ],
    },
  },
)
