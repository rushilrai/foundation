import { defineSchema } from 'convex/server'

import { patchTable, patchVersionTable } from './modules/patch/schema'
import { resumeTable } from './modules/resume/schema'
import { userTable } from './modules/user/schema'

// TEMP: validation off for the legacy-data migration deploy; revert after.
export default defineSchema(
  {
    patches: patchTable,
    patchVersions: patchVersionTable,
    resumes: resumeTable,
    users: userTable,
  },
  { schemaValidation: false },
)
