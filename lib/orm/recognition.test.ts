import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDrizzleSchema } from "./drizzle";
import { parsePrismaSchema } from "./prisma";
import { stripComments } from "./recognition";

test("says which file held no table, and where the code starts", () => {
  const schema = parseDrizzleSchema(
    [
      {
        path: "schemas/user.ts",
        content: `// a schema, eventually
import { pgTable } from 'drizzle-orm/pg-core';

export const helper = () => 1;`,
      },
    ],
    "en",
  );

  const diagnostic = schema.diagnostics.find((item) => item.level === "error");
  assert.ok(diagnostic, "expected an error diagnostic");
  assert.match(diagnostic.message, /No Drizzle table found in `schemas\/user\.ts`/);
  assert.match(diagnostic.message, /pgTable/);
  // The file is named the way its editor tab is, not by its basename.
  assert.equal(diagnostic.file, "schemas/user.ts");
  assert.equal(diagnostic.line, 4);
});

test("two imported files sharing a basename are judged separately", () => {
  const schema = parseDrizzleSchema(
    [
      {
        path: "schemas/user.ts",
        content: `import { pgTable, serial } from 'drizzle-orm/pg-core';
export const users = pgTable('users', { id: serial('id').primaryKey() });`,
      },
      { path: "admin/user.ts", content: "model User {\n  id Int @id\n}" },
    ],
    "en",
  );

  // Before file paths were tracked in full, `user.ts` was already marked as
  // produced and this file was skipped without a word.
  assert.deepEqual(
    schema.diagnostics.map((item) => item.file),
    ["admin/user.ts"],
  );
  assert.match(schema.diagnostics[0].message, /looks like a Prisma schema/);
});

test("names the ORM a file actually belongs to instead of dumping syntax errors", () => {
  const schema = parseDrizzleSchema(
    [
      {
        path: "schema.ts",
        content: `model User {
  id Int @id @default(autoincrement())
}`,
      },
    ],
    "en",
  );

  assert.deepEqual(
    schema.diagnostics.map((item) => item.level),
    ["error"],
  );
  assert.match(schema.diagnostics[0].message, /looks like a Prisma schema/);
});

test("the same message comes out in Turkish", () => {
  const schema = parsePrismaSchema(
    [{ path: "schema.prisma", content: "import { Entity } from 'typeorm';\n@Entity()\nclass A {}" }],
    "tr",
  );

  assert.match(schema.diagnostics[0].message, /TypeORM şemasına benziyor/);
});

test("supporting files that declare nothing stay quiet", () => {
  const schema = parseDrizzleSchema(
    [
      {
        path: "schemas/user.ts",
        content: `import { pgTable, serial } from 'drizzle-orm/pg-core';
export const users = pgTable('users', { id: serial('id').primaryKey() });`,
      },
      {
        path: "db.ts",
        content: `import { drizzle } from 'drizzle-orm/neon-serverless';
export const db = drizzle(process.env.DATABASE_URL!);`,
      },
    ],
    "en",
  );

  assert.deepEqual(schema.diagnostics, []);
});

test("commented-out code does not decide which ORM a file belongs to", () => {
  const schema = parseDrizzleSchema(
    [
      {
        path: "schema.ts",
        content: `// model User { id Int @id }
import { pgTable, serial } from 'drizzle-orm/pg-core';
export const users = pgTable('users', { id: serial('id').primaryKey() });`,
      },
    ],
    "en",
  );

  assert.deepEqual(schema.diagnostics, []);
});

test("stripComments keeps line numbers and string contents", () => {
  const stripped = stripComments(`const a = 1; // trailing
/* block
   spanning */
const url = "https://example.com"; // not a comment above`);

  assert.equal(stripped.split("\n").length, 4);
  assert.match(stripped, /https:\/\/example\.com/);
  assert.doesNotMatch(stripped, /trailing|spanning/);
});

test("a Prisma file holding only the connection config is not reported as unread", () => {
  const schema = parsePrismaSchema(
    [
      {
        path: "schema.prisma",
        content: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}`,
      },
      {
        path: "models/user.prisma",
        content: `model User {
  id    Int    @id @default(autoincrement())
  email String @unique
}`,
      },
    ],
    "en",
  );

  assert.deepEqual(
    schema.tables.map((table) => table.name),
    ["User"],
  );
  assert.equal(schema.dialect, "pg");
  assert.deepEqual(schema.diagnostics, []);
});

test("the unread-file warning quotes the selected ORM's own syntax", () => {
  const schema = parsePrismaSchema(
    [
      { path: "user.prisma", content: "model User {\n  id Int @id\n}" },
      // A model squeezed onto one line: recognisably Prisma, unreadable here.
      { path: "broken.prisma", content: "model Account { id Int @id }" },
    ],
    "en",
  );

  const warning = schema.diagnostics.find((item) => item.level === "warning");
  assert.ok(warning, "expected a warning for the unreadable file");
  assert.match(warning.message, /`model Name \{ \.\.\. \}` block/);
  assert.doesNotMatch(warning.message, /assigned to a variable/);
});
