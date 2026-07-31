import { defineSchema } from 'convex/server'

import { patchTable, patchVersionTable } from './modules/patch/schema'
import { resumeTable } from './modules/resume/schema'
import { userTable } from './modules/user/schema'

// Schema validation is temporarily disabled while existing documents still use
// the legacy header shape (header.linkedin). Deploy, run
// migrations:migrateHeaderLinks, then re-enable.
export default defineSchema(
  {
    patches: patchTable,
    patchVersions: patchVersionTable,
    resumes: resumeTable,
    users: userTable,
  },
  { schemaValidation: false },
)
