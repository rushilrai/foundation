import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
  preset: 'vercel',
  compatibilityDate: 'latest',
  ssrRoutes: ['/(.*)'],
  externals: {
    inline: ['@tabler/icons-react'],
  },
})
