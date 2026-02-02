import { defineSchema } from "convex/server";

import { userTable } from "./modules/user/schema";
import { itemTable, tagTable, itemTagTable } from "./modules/items/schema";

export default defineSchema({
  users: userTable,
  items: itemTable,
  tags: tagTable,
  itemTags: itemTagTable,
});
