import { defineSchema } from "convex/server";

import { userTable } from "./modules/user/schema";

export default defineSchema({
  users: userTable
});
