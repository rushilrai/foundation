import { schema } from "@foundation/db";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Database = NodePgDatabase<typeof schema>;

export let db: Database;

export async function setupDbConnection() {
    try {
        const databaseUrl = process.env.DATABASE_URL;

        if (!databaseUrl) {
            throw new Error("DATABASE_URL must be set");
        }

        const pool = new Pool({ connectionString: databaseUrl });

        db = drizzle(pool, { schema });

        const testQueryResult = await pool.query("SELECT 1");

        if (testQueryResult.rowCount !== 1) {
            throw new Error("Database connection test failed");
        }

        return db;
    } catch (error) {
        console.error("Database connection failed", error);
        throw error;
    }
}