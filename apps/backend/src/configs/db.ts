import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { schema } from "@fullstack/db";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Database = typeof db;