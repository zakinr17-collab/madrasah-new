import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';
import { resolveSqlConnection } from './connectionConfig.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function buildPoolConfig(): PoolConfig {
  return {
    ...resolveSqlConnection(),
    max: 10,
    connectionTimeoutMillis: 15000,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig());
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
