import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  databaseErrorCode,
  isTransientDatabaseError,
  safeErrorMetadata,
  shouldResetPrismaConnection,
} from "../src/lib/database-errors";
import { runtimeDatabaseUrl } from "../src/lib/database-url";

const pooledNeonUrl = "postgresql://neon_user:neon_password@ep-test-pooler.us-east-2.aws.neon.tech/jeevan?sslmode=disable&pgbouncer=true&connect_timeout=2&connection_limit=99&pool_timeout=2&socket_timeout=2";
const normalized = new URL(runtimeDatabaseUrl(pooledNeonUrl)!);
assert.equal(normalized.searchParams.get("sslmode"), "require");
assert.equal(normalized.searchParams.get("pgbouncer"), null);
assert.equal(normalized.searchParams.get("connect_timeout"), "15");
assert.equal(normalized.searchParams.get("connection_limit"), "3");
assert.equal(normalized.searchParams.get("pool_timeout"), "15");
assert.equal(normalized.searchParams.get("max_idle_connection_lifetime"), "240");
assert.equal(normalized.searchParams.get("socket_timeout"), "30");
assert.throws(
  () => runtimeDatabaseUrl("postgresql://user:password@ep-test.us-east-2.aws.neon.tech/jeevan"),
  /pooled endpoint/,
);
assert.equal(
  new URL(runtimeDatabaseUrl("postgresql://user:password@ep-test-pooler.us-east-2.aws.neon.tech/jeevan?sslmode=disable")!).searchParams.get("sslmode"),
  "require",
);
assert.equal(
  runtimeDatabaseUrl("postgresql://root@127.0.0.1:55432/jeevansahay_test?schema=public"),
  "postgresql://root@127.0.0.1:55432/jeevansahay_test?schema=public",
);

const closedConnection = Object.assign(new Error("kind: Closed; no credentials are included"), {
  name: "PrismaClientUnknownRequestError",
});
assert.equal(databaseErrorCode(closedConnection), "CONNECTION_CLOSED");
assert.equal(isTransientDatabaseError(closedConnection), true);
assert.equal(shouldResetPrismaConnection(closedConnection), true);

const neonClosedConnection = new Error("Error in PostgreSQL connection: Error { kind: Closed, cause: None }");
assert.equal(databaseErrorCode(neonClosedConnection), "CONNECTION_CLOSED");
assert.equal(isTransientDatabaseError(neonClosedConnection), true);

const terminatedConnection = Object.assign(new Error("Raw query failed"), {
  name: "PrismaClientKnownRequestError",
  code: "P2010",
  meta: { code: "57P01", message: "FATAL: terminating connection due to administrator command" },
});
assert.equal(databaseErrorCode(terminatedConnection), "57P01");
assert.equal(isTransientDatabaseError(terminatedConnection), true);
assert.equal(shouldResetPrismaConnection(terminatedConnection), true);

const exhaustedPool = Object.assign(new Error("pool exhausted"), { code: "P2024" });
assert.equal(isTransientDatabaseError(exhaustedPool), true);
assert.equal(shouldResetPrismaConnection(exhaustedPool), false);
assert.equal(shouldResetPrismaConnection(Object.assign(new Error("unavailable"), { code: "P1001" })), false);
assert.equal(isTransientDatabaseError(Object.assign(new Error("unique constraint"), { code: "P2002" })), false);

const metadata = safeErrorMetadata(Object.assign(new Error("postgresql://user:private@db.example/health"), { code: "P1002" }));
assert.deepEqual(metadata, { name: "Error", code: "P1002" });
assert.doesNotMatch(JSON.stringify(metadata), /private|db\.example/);
console.log("PASS Neon pool URL bounds, transient-error classification, and redacted diagnostics");

async function testConnectionRecovery() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error("Set TEST_DATABASE_URL to a disposable local PostgreSQL database whose name includes 'test'.");

  const testUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(testUrl.pathname.replace(/^\//, ""));
  if (
    !/^postgres(?:ql)?:$/.test(testUrl.protocol) ||
    !["localhost", "127.0.0.1", "::1"].includes(testUrl.hostname) ||
    !/(^|[-_])test($|[-_])/i.test(databaseName)
  ) {
    throw new Error("TEST_DATABASE_URL must target a local PostgreSQL database with 'test' in its name; remote and non-test databases are refused.");
  }
  if (databaseUrl === process.env.DATABASE_URL || databaseUrl === process.env.DIRECT_URL) {
    throw new Error("TEST_DATABASE_URL must be separate from application database URLs.");
  }

  const runtimeTestUrl = new URL(databaseUrl);
  runtimeTestUrl.searchParams.set("connection_limit", "1");
  runtimeTestUrl.searchParams.set("connect_timeout", "5");
  runtimeTestUrl.searchParams.set("pool_timeout", "5");
  process.env.DATABASE_URL = runtimeTestUrl.toString();
  process.env.DIRECT_URL = databaseUrl;

  const { prisma, resetPrismaConnection } = await import("../src/lib/prisma");
  const admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.$connect();
    const [{ pid }] = await prisma.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    const [{ terminated }] = await admin.$queryRaw<{ terminated: boolean }[]>`SELECT pg_terminate_backend(${pid}::integer) AS terminated`;
    assert.equal(terminated, true, "The isolated test PostgreSQL backend should be terminated.");

    let recovered = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const [{ value }] = await prisma.$queryRaw<{ value: number }[]>`SELECT 42::int AS value`;
        assert.equal(value, 42);
        recovered = true;
        break;
      } catch (error) {
        lastError = error;
        if (!isTransientDatabaseError(error) || attempt === 2) throw error;
        await resetPrismaConnection();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert.ok(recovered, `The Prisma client did not recover after the local backend was closed: ${databaseErrorCode(lastError) ?? "unknown"}`);
    console.log("PASS Prisma reconnects after an idle PostgreSQL connection is forcibly closed");
  } finally {
    await prisma.$disconnect();
    await admin.$disconnect();
  }
}

void testConnectionRecovery().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database recovery test failed");
  process.exitCode = 1;
});
