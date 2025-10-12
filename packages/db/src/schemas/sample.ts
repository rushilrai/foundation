import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const samplesTable = pgTable("samples", {
    id: varchar("id", { length: 36 }).primaryKey(),
    data: varchar("data", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: false })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull()
});

export const SampleSelectSchema = createSelectSchema(samplesTable);
export type SampleSelectSchema = z.infer<typeof SampleSelectSchema>;

export const SampleInsertSchema = createInsertSchema(samplesTable).pick({
    data: true,
});
export type SampleInsertSchema = z.infer<typeof SampleInsertSchema>;

export const SampleUpdateSchema = createInsertSchema(samplesTable).pick({
    data: true,
});
export type SampleUpdateSchema = z.infer<typeof SampleUpdateSchema>;