import baseConfig from '../../prettier.config.base.mjs'

/** @type {import('prettier').Config} */
const config = {
  ...baseConfig,
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-astro',
    'prettier-plugin-tailwindcss',
  ],
  overrides: [
    {
      files: '*.astro',
      options: { parser: 'astro' },
    },
  ],
  tailwindStylesheet: './src/index.css',
}

export default config
