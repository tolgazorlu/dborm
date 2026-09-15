import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDrizzleSchema } from "./index";

const SCHEMA = `import { pgTable, serial, text, integer, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
`;

const RELATIONS = `import { relations } from 'drizzle-orm';
import { users, posts } from './schema';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
`;

function parseExample() {
  return parseDrizzleSchema([
    { path: "schema.ts", content: SCHEMA },
    { path: "relations.ts", content: RELATIONS },
  ]);
}

test("derives tables and the dialect", () => {
  const schema = parseExample();
  assert.equal(schema.dialect, "pg");
  assert.deepEqual(
    schema.tables.map((table) => table.id),
    ["users", "posts"],
  );
  assert.equal(schema.tables[0].name, "users");
});

test("reads column names, types and constraints", () => {
  const users = parseExample().tables.find((table) => table.id === "users")!;

  assert.deepEqual(
    users.columns.map((column) => column.key),
    ["id", "name", "email", "createdAt"],
  );

  const id = users.columns[0];
  assert.equal(id.name, "id");
  assert.equal(id.type, "serial");
  assert.equal(id.isPrimaryKey, true);

  const email = users.columns.find((column) => column.key === "email")!;
  assert.equal(email.displayType, "varchar(255)");
  assert.equal(email.isNotNull, true);
  assert.equal(email.isUnique, true);

  const createdAt = users.columns.at(-1)!;
  assert.equal(createdAt.name, "created_at");
  assert.equal(createdAt.hasDefault, true);
  assert.equal(createdAt.isNotNull, true);
});

test("resolves a foreign key reference together with onDelete", () => {
  const posts = parseExample().tables.find((table) => table.id === "posts")!;
  const authorId = posts.columns.find((column) => column.key === "authorId")!;

  assert.deepEqual(authorId.reference, {
    table: "users",
    column: "id",
    onDelete: "cascade",
    onUpdate: undefined,
    isComposite: false,
  });

  const content = posts.columns.find((column) => column.key === "content")!;
  assert.equal(content.isNotNull, false);
  assert.equal(content.reference, undefined);
});

test("parses one/many relations with fields and references", () => {
  const { relations } = parseExample();

  assert.deepEqual(
    relations.map((relation) => relation.id),
    ["users.posts", "posts.author"],
  );

  const many = relations[0];
  assert.equal(many.kind, "many");
  assert.equal(many.sourceTable, "users");
  assert.equal(many.targetTable, "posts");
  assert.deepEqual(many.fields, []);

  const one = relations[1];
  assert.equal(one.kind, "one");
  assert.equal(one.sourceTable, "posts");
  assert.equal(one.targetTable, "users");
  assert.deepEqual(one.fields, ["authorId"]);
  assert.deepEqual(one.references, ["id"]);
});

test("the sample schema produces no structural warnings", () => {
  const errors = parseExample().diagnostics.filter((item) => item.level !== "info");
  assert.deepEqual(errors, []);
});

test("supports enum, index, composite key and foreignKey() forms", () => {
  const schema = parseDrizzleSchema([
    {
      path: "schema.ts",
      content: `import { pgTable, pgEnum, uuid, text, integer, index, primaryKey, foreignKey, timestamp } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('user_role', ['admin', 'member']);

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  role: roleEnum('role').notNull(),
  tags: text('tags').array(),
  bio: text('bio', { enum: ['short', 'long'] }),
});

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id').notNull(),
    orgId: uuid('org_id').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.orgId] }),
    index('memberships_org_idx').on(t.orgId),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('cascade'),
  ],
);
`,
    },
  ]);

  const users = schema.tables.find((table) => table.id === "users")!;
  assert.deepEqual(schema.enums[0], { id: "roleEnum", name: "user_role", values: ["admin", "member"] });

  assert.equal(users.columns[0].name, "id");
  assert.equal(users.columns[0].hasDefault, true);

  const role = users.columns.find((column) => column.key === "role")!;
  assert.equal(role.displayType, "enum(user_role)");
  assert.deepEqual(role.enumValues, ["admin", "member"]);

  assert.equal(users.columns.find((column) => column.key === "tags")!.displayType, "text[]");
  assert.deepEqual(users.columns.find((column) => column.key === "bio")!.enumValues, ["short", "long"]);

  const memberships = schema.tables.find((table) => table.id === "memberships")!;
  assert.deepEqual(memberships.compositePrimaryKey, ["userId", "orgId"]);
  assert.deepEqual(memberships.indexes, [
    { name: "memberships_org_idx", columns: ["orgId"], isUnique: false },
  ]);
  assert.equal(memberships.columns.find((column) => column.key === "joinedAt")!.displayType, "timestamp tz");

  const userId = memberships.columns.find((column) => column.key === "userId")!;
  assert.equal(userId.reference?.table, "users");
  assert.equal(userId.reference?.onDelete, "cascade");
  assert.equal(userId.reference?.isComposite, true);
});

test("recognises the mysql and sqlite dialects", () => {
  const mysql = parseDrizzleSchema([
    {
      path: "schema.ts",
      content: `import { mysqlTable, int, varchar } from 'drizzle-orm/mysql-core';
export const users = mysqlTable('users', { id: int('id').primaryKey() });`,
    },
  ]);
  assert.equal(mysql.dialect, "mysql");

  const sqlite = parseDrizzleSchema([
    {
      path: "schema.ts",
      content: `import { sqliteTable, integer } from 'drizzle-orm/sqlite-core';
export const users = sqliteTable('users', { id: integer('id').primaryKey() });`,
    },
  ]);
  assert.equal(sqlite.dialect, "sqlite");
});

test("warns about an unknown reference and a missing primary key", () => {
  const schema = parseDrizzleSchema([
    {
      path: "schema.ts",
      content: `import { pgTable, integer } from 'drizzle-orm/pg-core';
export const logs = pgTable('logs', {
  userId: integer('user_id').references(() => users.id),
});`,
    },
  ]);

  const messages = schema.diagnostics.map((item) => item.message).join("\n");
  assert.match(messages, /birincil anahtar tanımlı değil/);
  assert.match(messages, /bilinmeyen bir tabloya referans/);
});

test("does not crash on a syntax error and returns a diagnostic", () => {
  const schema = parseDrizzleSchema([
    { path: "schema.ts", content: "export const users = pgTable('users', {" },
  ]);
  assert.ok(schema.diagnostics.some((item) => item.level === "error"));
});

test("returns an empty schema for empty input", () => {
  const schema = parseDrizzleSchema([{ path: "schema.ts", content: "   " }]);
  assert.deepEqual(schema.tables, []);
  assert.deepEqual(schema.diagnostics, []);
});

test("reads tables declared on a pgSchema object", () => {
  const schema = parseDrizzleSchema([
    {
      path: "schema.ts",
      content: `import { pgSchema, serial, text } from 'drizzle-orm/pg-core';

export const appSchema = pgSchema('app');

export const users = appSchema.table('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
});`,
    },
  ]);

  assert.equal(schema.dialect, "pg");
  assert.deepEqual(
    schema.tables.map((table) => table.name),
    ["app.users"],
  );
});

test("reads tables built by a table creator and applies its name pattern", () => {
  const schema = parseDrizzleSchema([
    {
      path: "schema.ts",
      content: `import { pgTableCreator, serial } from 'drizzle-orm/pg-core';

export const createTable = pgTableCreator((name) => \`acme_\${name}\`);

export const users = createTable('users', { id: serial('id').primaryKey() });`,
    },
  ]);

  assert.deepEqual(
    schema.tables.map((table) => table.name),
    ["acme_users"],
  );
});

test("reads a table through `as const` and `satisfies` wrappers", () => {
  const schema = parseDrizzleSchema([
    {
      path: "schema.ts",
      content: `import { pgTable, serial } from 'drizzle-orm/pg-core';
export const users = pgTable('users', { id: serial('id').primaryKey() }) as const;`,
    },
  ]);

  assert.equal(schema.tables.length, 1);
});

test("reads an enum declared on a pgSchema object", () => {
  const schema = parseDrizzleSchema([
    {
      path: "schema.ts",
      content: `import { pgSchema, serial } from 'drizzle-orm/pg-core';
export const appSchema = pgSchema('app');
export const roleEnum = appSchema.enum('role', ['admin', 'viewer']);
export const users = appSchema.table('users', {
  id: serial('id').primaryKey(),
  role: roleEnum('role').notNull(),
});`,
    },
  ]);

  assert.deepEqual(schema.enums.map((item) => item.values), [["admin", "viewer"]]);
  assert.equal(schema.tables[0].columns[1].displayType, "enum(role)");
});

test("commented-out tables are ignored, comments between columns are not", () => {
  const schema = parseDrizzleSchema([
    {
      path: "schema.ts",
      content: `import { pgTable, serial, text } from 'drizzle-orm/pg-core';

// export const ghosts = pgTable('ghosts', { id: serial('id').primaryKey() });

/*
export const alsoGhosts = pgTable('also_ghosts', {});
*/

export const users = pgTable('users', {
  id: serial('id').primaryKey(), // the surrogate key
  /** the login address */
  email: text('email').notNull(),
});`,
    },
  ]);

  assert.deepEqual(
    schema.tables.map((table) => table.name),
    ["users"],
  );
  assert.deepEqual(
    schema.tables[0].columns.map((column) => column.name),
    ["id", "email"],
  );
});

test("reads tables spread over several imported files", () => {
  const schema = parseDrizzleSchema([
    {
      path: "schemas/user.ts",
      content: `import { pgTable, serial, text } from 'drizzle-orm/pg-core';
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
});`,
    },
    {
      path: "schemas/product.ts",
      content: `import { pgTable, serial, integer } from 'drizzle-orm/pg-core';
import { users } from './user';
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
});`,
    },
  ]);

  assert.deepEqual(
    schema.tables.map((table) => table.name),
    ["users", "products"],
  );
  assert.deepEqual(schema.tables[1].columns[1].reference, {
    table: "users",
    column: "id",
    onDelete: "cascade",
    onUpdate: undefined,
    isComposite: false,
  });
  assert.deepEqual(schema.diagnostics, []);
});

test("warns when two files export the same table identifier", () => {
  const schema = parseDrizzleSchema(
    [
      {
        path: "schema.ts",
        content: `import { pgTable, serial } from 'drizzle-orm/pg-core';
export const users = pgTable('users', { id: serial('id').primaryKey() });`,
      },
      {
        path: "schemas/user.ts",
        content: `import { pgTable, serial } from 'drizzle-orm/pg-core';
export const users = pgTable('app_users', { id: serial('id').primaryKey() });`,
      },
    ],
    "en",
  );

  assert.equal(schema.tables.length, 2);
  assert.ok(
    schema.diagnostics.some((item) => /declared in two files/.test(item.message)),
    "expected a duplicate identifier warning",
  );
});
