import { defineSchema } from 'convex/server'

import { patchTable, patchVersionTable } from './modules/patch/schema'
import { resumeTable } from './modules/resume/schema'
import { userTable } from './modules/user/schema'

export default defineSchema({
  patches: patchTable,
  patchVersions: patchVersionTable,
  resumes: resumeTable,
  users: userTable,
})
