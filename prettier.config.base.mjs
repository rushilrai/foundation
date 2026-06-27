/** @type {import('prettier').Config} */
const config = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  semi: false,
  trailingComma: 'all',
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrder: [
    '<BUILTIN_MODULES>',
    '<THIRD_PARTY_MODULES>',
    '',
    '^@foundation/(.*)$',
    '',
    '^@/(.*)$',
    '^[./]',
  ],
  importOrderTypeScriptVersion: '5.0.0',
}

export default config
