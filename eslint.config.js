import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import js from '@eslint/js'
import { createNodeResolver, importX } from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import sonarjs from 'eslint-plugin-sonarjs'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// The same rules as Hodi's own code.
export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  comments.recommended,
  {
    plugins: { 'import-x': importX, sonarjs },
    settings: { 'import-x/resolver-next': [createNodeResolver()] },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // == null stays: it covers null and undefined at once.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      '@eslint-community/eslint-comments/require-description': 'error',
      'import-x/no-cycle': 'error'
    }
  },
  {
    // Sizes: warnings until the big files are split, then errors.
    files: ['server/**/*.ts', 'web/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'sonarjs/cognitive-complexity': ['warn', 15]
    }
  },
  {
    files: ['server/**/*.ts', 'test/**/*.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules }
  }
)
