import { defineSchema } from 'convex/server'

import { linkCountTable, linkTable } from './modules/link/schema'

export default defineSchema({
  links: linkTable,
  linkCounts: linkCountTable,
})
