import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
  preset: 'vercel',
  compatibilityDate: 'latest',
  ssrRoutes: ['/(.*)'],
  noExternals: ['@tabler/icons-react'],
})
