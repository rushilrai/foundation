import { defineSchema } from "convex/server";

import { userTable } from "./modules/user/schema";
import { resumeTable } from "./modules/resume/schema";
import { patchTable } from "./modules/patch/schema";

export default defineSchema({
  patches: patchTable,
  resumes: resumeTable,
  users: userTable,
});
