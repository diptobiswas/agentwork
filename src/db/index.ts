import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For serverless environments (Vercel), use connection pooling
const client = postgres(connectionString, { 
  prepare: false,
  ssl: 'require'
});

export const db = drizzle(client, { schema });

export * from './schema';
