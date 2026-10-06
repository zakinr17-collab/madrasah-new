import fs from 'node:fs';

type SqlFilesystem = Pick<typeof fs, 'existsSync' | 'readdirSync' | 'statSync'>;
export type SqlConnection = {
  host: string;
  port: number;
  user: string | undefined;
  password: string | undefined;
  database: string;
};

export class SqlConfigurationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'SqlConfigurationError';
  }
}

export function sqlOnlineMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = String(env.APP_MODE || '').trim().toLowerCase();
  if (mode === 'online') return true;
  if (mode === 'offline') return false;
  return Boolean(env.K_SERVICE && (env.K_REVISION || env.K_CONFIGURATION));
}

const validConnectionName = (name: string) =>
  name !== '.' && name !== '..' && /^[A-Za-z0-9_.:-]+$/.test(name);

function socketHost(host: string, files: SqlFilesystem): string {
  const normalized = host.replace(/\/$/, '');
  const alternate = normalized.startsWith('/app/cloudsql/')
    ? normalized.slice(4) : '/app' + normalized;
  if (files.existsSync(normalized)) return normalized;
  if (files.existsSync(alternate)) return alternate;
  return normalized; // Never fall back to a different instance if this one is absent.
}

// Shared by Express, the optional Drizzle helper, and schema tooling.
// ONLINE never falls back to a URL-based or non-Cloud-SQL connection.
export function resolveSqlConnection(
  env: NodeJS.ProcessEnv = process.env,
  online = sqlOnlineMode(env),
  files: SqlFilesystem = fs,
): SqlConnection {
  const host = String(env.SQL_HOST || '').trim();
  const user = String(env.SQL_USER || env.PGUSER || env.SQL_ADMIN_USER || '').trim();
  const password = env.SQL_PASSWORD || env.PGPASSWORD || env.SQL_ADMIN_PASSWORD;
  const database = String(env.SQL_DB_NAME || env.PGDATABASE || 'cloud_sql_production_database').trim();
  const connectionName = String(env.CLOUD_SQL_CONNECTION_NAME || env.INSTANCE_CONNECTION_NAME || '').trim();
  const port = Number(env.SQL_PORT || env.PGPORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SqlConfigurationError('SQL_PORT_INVALID', 'SQL_PORT/PGPORT must be an integer between 1 and 65535.');
  }
  if (!database) throw new SqlConfigurationError('SQL_DATABASE_MISSING', 'SQL_DB_NAME/PGDATABASE must not be blank.');
  if (online && (!user || !password)) {
    throw new SqlConfigurationError('ONLINE_CLOUD_SQL_CONFIG_MISSING', 'ONLINE mode requires SQL_USER/PGUSER and SQL_PASSWORD/PGPASSWORD (SQL_ADMIN aliases are supported).');
  }

  let selectedHost = host;
  if (host) {
    const match = host.match(/^\/(?:app\/)?cloudsql\/([^/]+)\/?$/);
    if (match && validConnectionName(match[1])) {
      selectedHost = socketHost(host, files);
    } else if (online || host.startsWith('/cloudsql') || host.startsWith('/app/cloudsql')) {
      throw new SqlConfigurationError('ONLINE_CLOUD_SQL_HOST_INVALID', 'ONLINE SQL_HOST must be a Cloud SQL Unix socket path.');
    }
  } else if (connectionName) {
    if (!validConnectionName(connectionName)) {
      throw new SqlConfigurationError('ONLINE_CLOUD_SQL_CONNECTION_NAME_INVALID', 'CLOUD_SQL_CONNECTION_NAME contains invalid characters.');
    }
    selectedHost = socketHost('/cloudsql/' + connectionName, files);
  } else if (online) {
    const discovered = new Map<string, string>();
    for (const baseDir of ['/cloudsql', '/app/cloudsql']) {
      try {
        if (!files.existsSync(baseDir)) continue;
        for (const entry of files.readdirSync(baseDir) as string[]) {
          if (!validConnectionName(entry) || discovered.has(entry)) continue;
          const candidate = baseDir + '/' + entry;
          if (files.statSync(candidate).isDirectory()) discovered.set(entry, candidate);
        }
      } catch {
        throw new SqlConfigurationError('ONLINE_CLOUD_SQL_SOCKET_UNREADABLE', 'Cannot inspect Cloud SQL mounts. Set SQL_HOST or CLOUD_SQL_CONNECTION_NAME explicitly.');
      }
    }
    if (discovered.size > 1) {
      throw new SqlConfigurationError('ONLINE_CLOUD_SQL_SOCKET_AMBIGUOUS', 'Multiple Cloud SQL sockets are mounted. Set SQL_HOST or CLOUD_SQL_CONNECTION_NAME explicitly.');
    }
    selectedHost = Array.from(discovered.values())[0] || '';
    if (!selectedHost) {
      throw new SqlConfigurationError('ONLINE_CLOUD_SQL_SOCKET_NOT_FOUND', 'No mounted Cloud SQL Unix socket was found.');
    }
  } else {
    selectedHost = 'localhost';
  }

  return { host: selectedHost, port, user: user || undefined, password, database };
}
