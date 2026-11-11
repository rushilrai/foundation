import { defineSchema } from 'convex/server'

import { linkTable } from './modules/link/schema'

export default defineSchema({
  links: linkTable,
})
