import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

const pool =
  global._pgPool ??
  new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

// In development, reuse the pool across hot reloads to avoid exhausting connections
if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool;
}

export default pool;
