import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  // Astro 7 defaults to 'jsx', which drops whitespace at line breaks (e.g. after the footer's ©)
  compressHTML: true,
  vite: {
    plugins: [tailwindcss()],
  },
})
