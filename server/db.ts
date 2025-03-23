import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// Use the DATABASE_URL from environment variables
const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });