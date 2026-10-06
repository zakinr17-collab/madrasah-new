import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { resolveSqlConnection } from './src/db/connectionConfig.ts';

const connection = resolveSqlConnection();
if (!connection.user) throw new Error('Set SQL_USER/PGUSER before running Drizzle tooling.');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: connection,
});
