import { defineSchema } from 'convex/server'

import { patchTable, patchVersionTable } from './modules/patch/schema'
import { documentTable, profileTable } from './modules/profile/schema'
import { resumeTable } from './modules/resume/schema'
import { userTable } from './modules/user/schema'

export default defineSchema({
  documents: documentTable,
  patches: patchTable,
  patchVersions: patchVersionTable,
  profiles: profileTable,
  resumes: resumeTable,
  users: userTable,
})
