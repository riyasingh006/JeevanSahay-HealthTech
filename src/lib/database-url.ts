const NEON_POOL_SETTINGS = {
  sslmode: "require",
  connect_timeout: "15",
  connection_limit: "3",
  pool_timeout: "15",
  max_idle_connection_lifetime: "240",
  socket_timeout: "30",
};

export function runtimeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname.endsWith(".neon.tech")) {
    const endpoint = hostname.split(".")[0] ?? "";
    if (!endpoint.endsWith("-pooler")) {
      throw new Error("DATABASE_URL must use Neon's pooled endpoint; reserve the direct endpoint for migrations.");
    }
    url.searchParams.delete("pgbouncer");
    for (const [key, value] of Object.entries(NEON_POOL_SETTINGS)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}
