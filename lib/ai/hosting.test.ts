import assert from "node:assert/strict";
import { test } from "node:test";

import { detectHosting, withChoice } from "./hosting";

const file = (content: string) => [{ path: "db.ts", content }];

test("recognises serverless providers from their drivers", () => {
  const neon = detectHosting(
    file(`import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';`),
  );
  assert.equal(neon.kind, "serverless");
  // The Neon driver exports its own `Pool`; that must not be read as self-hosted.
  assert.deepEqual(neon.evidence, ["Neon"]);

  assert.equal(detectHosting(file("import { sql } from '@vercel/postgres';")).kind, "serverless");
  assert.equal(
    detectHosting(file("import { connect } from '@planetscale/database';")).kind,
    "serverless",
  );
});

test("recognises a long-lived server from a pooled driver", () => {
  const hosting = detectHosting(
    file(`import { Pool } from 'pg';
export const pool = new Pool({ connectionString: 'postgres://localhost:5432/app' });`),
  );

  assert.equal(hosting.kind, "self-hosted");
  assert.ok(hosting.evidence.includes("node-postgres pool"));
  assert.ok(hosting.evidence.includes("local database URL"));
});

test("a bare schema file gives nothing away", () => {
  const hosting = detectHosting(file("import { pgTable } from 'drizzle-orm/pg-core';"));
  assert.equal(hosting.kind, "unknown");
  assert.deepEqual(hosting.evidence, []);
});

test("an explicit choice wins over detection, and is marked as chosen", () => {
  const detected = detectHosting(file("import { Pool } from 'pg';"));

  const chosen = withChoice(detected, "serverless");
  assert.equal(chosen.kind, "serverless");
  assert.equal(chosen.chosen, true);

  assert.equal(withChoice(detected, "unknown").kind, "self-hosted");
  assert.equal(withChoice(detected, "nonsense").kind, "self-hosted");
  assert.equal(withChoice(detected, undefined).chosen, false);
});
