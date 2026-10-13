import { defineSchema } from 'convex/server'

import { patchTable } from './modules/patch/schema'
import { resumeTable } from './modules/resume/schema'
import { userTable } from './modules/user/schema'

export default defineSchema({
  patches: patchTable,
  resumes: resumeTable,
  users: userTable,
})
