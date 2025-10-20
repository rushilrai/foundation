import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from "@neondatabase/serverless";

import { schema } from "../schema";

type Database = NeonHttpDatabase<typeof schema>;

export let db: Database;

export async function setupDbConnection() {
    try {
        const databaseUrl = process.env.DATABASE_URL;

        if (!databaseUrl) {
            throw new Error("DATABASE_URL must be set");
        }

        const sql = neon(databaseUrl);
        db = drizzle({ client: sql });

        const testQueryResult = await sql.query("SELECT 1");

        if (testQueryResult.length !== 1) {
            throw new Error("Database connection test failed");
        }

        console.log("Database connection successful");

        return db;
    } catch (error) {
        console.error("Database connection failed", error);
        throw error;
    }
}