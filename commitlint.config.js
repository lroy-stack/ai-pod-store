export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'frontend',
        'admin',
        'mcp-server',
        'podclaw',
        'deploy',
        'ci',
        'docs',
        'deps',
      ],
    ],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
  },
}
