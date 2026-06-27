import baseConfig from '../../prettier.config.base.mjs'

/** @type {import('prettier').Config} */
const config = {
  ...baseConfig,
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
  tailwindStylesheet: './src/index.css',
}

export default config
