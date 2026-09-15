import type { Dialect } from "@/lib/orm/types";
import type { Hosting } from "./hosting";

/**
 * Per-dialect review checklists. These are the judgement calls a reviewer
 * should make that the deterministic rule engine cannot, phrased as things to
 * look for in the schema rather than as generic advice.
 *
 * The PostgreSQL list follows the practices published in the Postgres agent
 * skills (github.com/neondatabase/postgres-skills, supabase/postgres-skills).
 */
const POSTGRES = `PostgreSQL specifics to check (PG 14-18):
- Keys: prefer \`GENERATED ALWAYS AS IDENTITY\` over \`serial\`/\`bigserial\`; int4 identity
  runs out at 2.1B rows, so say so on tables that will grow. For distributed or
  client-generated ids prefer time-ordered UUIDv7 over UUIDv4, which fragments the
  B-tree index it is the key of.
- Time: \`timestamptz\`, never bare \`timestamp\`; flag every naive timestamp column.
- Text: \`text\` plus a \`CHECK (length(...))\` beats \`varchar(n)\` — \`varchar(n)\` buys no
  speed and makes the limit hard to change. Case-insensitive lookups (email, handle)
  need \`citext\` or a unique index on \`lower(col)\`.
- Money and measurement: \`numeric\`, never \`float\`/\`double precision\`.
- Foreign keys: PostgreSQL does NOT index them for you. An unindexed FK column means
  slow joins and a full scan of the child on every parent delete.
- Indexes: put equality columns before range/sort columns in a composite; an index on
  (a, b) makes a separate index on (a) redundant. Use partial indexes for the rows
  actually queried (\`WHERE deleted_at IS NULL\`, \`WHERE status = 'active'\`), \`INCLUDE\`
  for index-only scans, GIN for jsonb/array containment, BRIN for append-only
  time-series, and expression indexes only when the query uses the same expression.
- Enums: \`CREATE TYPE ... AS ENUM\` cannot drop or reorder values and adding one cannot
  run inside a transaction with other DDL — if the set carries metadata or changes with
  the product, a lookup table with an FK is the better call.
- Constraints: CHECK constraints for business rules (price > 0, end_date > start_date),
  \`EXCLUDE USING gist\` for non-overlap (bookings, schedules), \`NULLS NOT DISTINCT\`
  (PG15+) when NULL must not slip past a unique index.
- jsonb is for genuinely variable payloads, not for columns that deserve to exist; if it
  is filtered on, it needs a GIN index.
- Scale: partition once a table passes tens of millions of rows and is always filtered by
  the same key (the partition key must be part of every unique index); a materialized
  view needs a unique index before it can refresh concurrently.
- Multi-tenancy: \`tenant_id\` belongs in the table AND as the leading column of the
  composite indexes; mention Row-Level Security when tenant data shares a table.
- Migration safety on a live table: \`ALTER COLUMN TYPE\` rewrites the whole table under an
  exclusive lock, \`SET NOT NULL\` scans it — the safe path is \`CHECK ... NOT VALID\` then
  \`VALIDATE CONSTRAINT\`; new indexes need \`CREATE INDEX CONCURRENTLY\`.`;

const MYSQL = `MySQL/MariaDB specifics to check:
- Charset must be \`utf8mb4\` (\`utf8\` is a 3-byte subset that cannot store emoji) with a
  deliberate collation; \`utf8mb4_0900_ai_ci\` is case-insensitive, \`_bin\` is not.
- InnoDB clusters rows on the primary key: a random UUID PK scatters writes across the
  B-tree. Prefer an auto-increment or ordered key, and keep secondary indexes in mind —
  each one carries a copy of the PK.
- Index prefix limits (767/3072 bytes) bite long \`varchar\` keys; prefix indexes
  (\`KEY (col(32))\`) cannot serve ORDER BY.
- \`DATETIME\` has no time zone and \`TIMESTAMP\` ends in 2038; say which one a column wants.
- Money is \`DECIMAL\`, never \`FLOAT\`.
- MySQL creates an index for every foreign key automatically — do not report those as
  missing; report missing indexes for filters and sorts instead.`;

const SQLITE = `SQLite specifics to check:
- Foreign keys are only enforced when \`PRAGMA foreign_keys = ON\` per connection.
- Types are advisory (dynamic typing); use STRICT tables when integrity matters.
- \`INTEGER PRIMARY KEY\` is the rowid alias — any other type is a second index.
- Timestamps are text/integer by convention; say which convention the schema is using.
- One writer at a time: WAL mode and short transactions matter more than index tuning.`;

const MONGO = `MongoDB specifics to check:
- There are no database-level foreign keys; referential integrity is the application's
  job. Judge embedding versus referencing by access pattern and document growth.
- Unbounded arrays inside a document are the classic failure: the 16 MB limit and
  rewrite cost make an unbounded array a separate collection.
- Compound index order follows the ESR rule (equality, sort, range).
- Schema-level \`unique\` creates a unique index — check that it matches the real key,
  including partial filter expressions for optional fields.`;

const GENERIC = `The dialect could not be determined from the schema. Where advice depends on it
(identity columns, enum handling, whether foreign keys are indexed automatically), say
which database you are assuming.`;

const DIALECT_GUIDANCE: Record<Dialect, string> = {
  pg: POSTGRES,
  mysql: MYSQL,
  sqlite: SQLITE,
  sqlserver: GENERIC,
  mongo: MONGO,
  unknown: GENERIC,
};

const SERVERLESS = `Deployment: a serverless / pooled platform (Neon, Supabase, Vercel Postgres,
PlanetScale, D1, Lambda). Weigh the schema accordingly:
- Connections are multiplexed through a transaction-mode pooler, so session state does not
  survive: \`SET\` (use \`SET LOCAL\`), \`LISTEN\`/\`NOTIFY\`, SQL-level \`PREPARE\`, session
  advisory locks and \`WITH HOLD\` cursors do not work. Flag any design that needs them.
- Every query pays network latency from a short-lived function, so chatty access patterns
  and N+1 shapes hurt far more than they would on a co-located server. Prefer designs that
  answer a screen in one round trip.
- Long transactions hold a pooled connection hostage; batch jobs, migrations that lock and
  \`idle in transaction\` are worse here than on a dedicated server.
- Background work (cron, queues, pg_cron, triggers doing heavy work) often is not available
  or is billed separately — prefer designs that do not rely on them.
- Storage and egress are metered: wide rows, duplicated columns and unbounded JSON have a
  direct cost.`;

const SELF_HOSTED = `Deployment: a long-lived, self-hosted / on-prem server. Weigh the schema accordingly:
- Connections are persistent, so the usual tuning applies: a pooler (PgBouncer) in front,
  a sane per-instance pool, and \`idle_in_transaction_session_timeout\` to protect it.
- Extensions, cron jobs, materialized views, partition maintenance and replication are all
  available — recommend them where the schema would benefit.
- Autovacuum and bloat are the operator's problem: high-churn tables, wide updates and
  unused indexes are worth calling out, as are indexes that will not fit in memory.
- Backup and restore time scales with the schema: unpartitioned giants and blobs stored in
  the database are legitimate findings.`;

const UNKNOWN_HOSTING = `Deployment: unknown — nothing in the pasted files names a driver or a provider.
Do not guess. Where a finding depends on it (connection pooling, background jobs,
long transactions, extensions), state the condition in one clause instead of assuming.`;

const HOSTING_GUIDANCE: Record<Hosting["kind"], string> = {
  serverless: SERVERLESS,
  "self-hosted": SELF_HOSTED,
  unknown: UNKNOWN_HOSTING,
};

/** The dialect and deployment blocks appended to the reviewer's system prompt. */
export function buildContextGuidance(dialect: Dialect, hosting: Hosting): string {
  const evidence =
    hosting.evidence.length > 0 ? `\nDetected from the files: ${hosting.evidence.join(", ")}.` : "";
  const chosen = hosting.chosen ? "\nThe user selected this deployment target explicitly." : "";

  return `${DIALECT_GUIDANCE[dialect]}\n\n${HOSTING_GUIDANCE[hosting.kind]}${evidence}${chosen}`;
}
