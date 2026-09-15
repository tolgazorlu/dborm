import type { ParserFile } from "@/lib/orm/types";

/**
 * Where the database is expected to run. The advice a reviewer should give
 * differs sharply between a pooled serverless platform and a long-lived
 * self-hosted server, so this is worth knowing before the review starts.
 */
export type HostingKind = "serverless" | "self-hosted" | "unknown";

export interface Hosting {
  kind: HostingKind;
  /** Providers and drivers the detection recognised, for the prompt and the UI. */
  evidence: string[];
  /** True when the user picked the value instead of it being detected. */
  chosen: boolean;
}

interface Signal {
  label: string;
  patterns: RegExp[];
}

const SERVERLESS_SIGNALS: Signal[] = [
  {
    label: "Neon",
    patterns: [/@neondatabase\/serverless/, /drizzle-orm\/neon-(?:http|serverless)/, /\bneonConfig\b/, /\.neon\.tech/],
  },
  { label: "Vercel Postgres", patterns: [/@vercel\/postgres/, /drizzle-orm\/vercel-postgres/] },
  { label: "Supabase", patterns: [/@supabase\/supabase-js/, /\.supabase\.co/, /supabase\.com\/dashboard/] },
  {
    label: "PlanetScale",
    patterns: [/@planetscale\/database/, /drizzle-orm\/planetscale-serverless/, /\.psdb\.cloud/],
  },
  { label: "Cloudflare D1", patterns: [/drizzle-orm\/d1/, /\bD1Database\b/] },
  { label: "Turso / libSQL", patterns: [/@libsql\/client/, /drizzle-orm\/libsql/, /\.turso\.io/] },
  {
    label: "Prisma Accelerate",
    patterns: [/@prisma\/extension-accelerate/, /prisma:\/\//, /accelerate\.prisma-data\.net/],
  },
  { label: "MongoDB Atlas", patterns: [/mongodb\+srv:\/\//] },
  { label: "Xata", patterns: [/@xata\.io\//] },
  { label: "edge runtime", patterns: [/runtime\s*[:=]\s*['"]edge['"]/] },
  { label: "AWS Lambda", patterns: [/aws-lambda/, /\bAPIGatewayProxyHandler\b/] },
];

const SELF_HOSTED_SIGNALS: Signal[] = [
  { label: "node-postgres pool", patterns: [/drizzle-orm\/node-postgres/, /new\s+Pool\s*\(/, /from\s*['"]pg['"]/] },
  { label: "postgres.js", patterns: [/drizzle-orm\/postgres-js/, /from\s*['"]postgres['"]/] },
  { label: "mysql2", patterns: [/from\s*['"]mysql2/, /drizzle-orm\/mysql2/] },
  { label: "TypeORM DataSource", patterns: [/new\s+DataSource\s*\(/] },
  { label: "local database URL", patterns: [/(?:localhost|127\.0\.0\.1):(?:5432|3306|27017)/] },
  { label: "PgBouncer", patterns: [/pgbouncer/i] },
  { label: "Docker Compose", patterns: [/docker-compose/, /image:\s*postgres/] },
];

export function isHostingKind(value: unknown): value is HostingKind {
  return value === "serverless" || value === "self-hosted" || value === "unknown";
}

/**
 * Guesses the deployment target from driver imports and connection strings in
 * the files the user pasted. It only reports what it can actually see: a bare
 * schema file carries no hosting signal and stays `unknown`.
 */
export function detectHosting(files: ParserFile[]): Hosting {
  const content = files.map((file) => file.content).join("\n");

  const serverless = matches(SERVERLESS_SIGNALS, content);
  const selfHosted = matches(SELF_HOSTED_SIGNALS, content);

  // A serverless driver wins outright: providers such as Neon ship a `Pool`
  // of their own, so the self-hosted markers it also matches are noise.
  if (serverless.length > 0) {
    return { kind: "serverless", evidence: serverless, chosen: false };
  }
  if (selfHosted.length > 0) {
    return { kind: "self-hosted", evidence: selfHosted, chosen: false };
  }

  return { kind: "unknown", evidence: [], chosen: false };
}

/** Applies an explicit choice from the UI over whatever was detected. */
export function withChoice(detected: Hosting, choice: unknown): Hosting {
  if (!isHostingKind(choice) || choice === "unknown") return detected;
  return { kind: choice, evidence: detected.evidence, chosen: true };
}

function matches(signals: Signal[], content: string): string[] {
  return signals
    .filter((signal) => signal.patterns.some((pattern) => pattern.test(content)))
    .map((signal) => signal.label);
}
