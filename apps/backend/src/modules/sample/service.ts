import { db } from "../../configs/db";
import { samplesTable, SampleInsertSchema, SampleUpdateSchema } from "@fullstack/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

export async function listSamples() {
    return await db.select().from(samplesTable).orderBy(samplesTable.createdAt);
}

export async function getSampleById(id: string) {
    const rows = await db.select().from(samplesTable).where(eq(samplesTable.id, id)).limit(1);
    return rows[0] ?? null;
}

export async function createSample(input: z.infer<typeof SampleInsertSchema>) {
    const parsed = SampleInsertSchema.parse(input);
    const [row] = await db.insert(samplesTable).values({ ...parsed, id: crypto.randomUUID() }).returning();
    return row;
}

export async function updateSample(id: string, input: z.infer<typeof SampleUpdateSchema>) {
    const parsed = SampleUpdateSchema.parse(input);
    const [row] = await db.update(samplesTable).set(parsed).where(eq(samplesTable.id, id)).returning();
    return row ?? null;
}

export async function deleteSample(id: string) {
    const [row] = await db.delete(samplesTable).where(eq(samplesTable.id, id)).returning();
    return row ?? null;
}

