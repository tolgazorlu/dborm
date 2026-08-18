import assert from "node:assert/strict";
import { test } from "node:test";

import { parseKyselySchema } from "./index";

const SCHEMA = `import { Generated, ColumnType } from 'kysely';

export interface UserTable {
  id: Generated<number>;
  email: string;
  bio: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PostTable {
  id: Generated<number>;
  title: string;
  published: Generated<boolean>;
  user_id: number;
  tags: string[];
}

export interface Database {
  users: UserTable;
  posts: PostTable;
}
`;

function parse() {
  return parseKyselySchema([{ path: "database.ts", content: SCHEMA }]);
}

test("takes table names from the Database interface", () => {
  const schema = parse();
  assert.equal(schema.orm, "kysely");
  assert.deepEqual(
    schema.tables.map((table) => `${table.id}:${table.name}`),
    ["UserTable:users", "PostTable:posts"],
  );
});

test("unwraps Generated and ColumnType wrappers", () => {
  const user = parse().tables.find((table) => table.id === "UserTable")!;

  const id = user.columns[0];
  assert.equal(id.type, "numeric");
  assert.equal(id.isPrimaryKey, true);
  assert.equal(id.hasDefault, true);

  const createdAt = user.columns.find((column) => column.key === "created_at")!;
  assert.equal(createdAt.type, "timestamp");
});

test("treats a null union as nullable", () => {
  const user = parse().tables.find((table) => table.id === "UserTable")!;
  assert.equal(user.columns.find((column) => column.key === "bio")!.isNotNull, false);
  assert.equal(user.columns.find((column) => column.key === "email")!.isNotNull, true);
});

test("flags array types", () => {
  const post = parse().tables.find((table) => table.id === "PostTable")!;
  const tags = post.columns.find((column) => column.key === "tags")!;
  assert.equal(tags.isArray, true);
  assert.equal(tags.displayType, "text[]");
});

test("infers relations from the naming convention and flags them", () => {
  const post = parse().tables.find((table) => table.id === "PostTable")!;
  const userId = post.columns.find((column) => column.key === "user_id")!;

  assert.deepEqual(userId.reference, {
    table: "UserTable",
    column: "id",
    isComposite: false,
    isInferred: true,
  });
});

test("does not invent a reference when no table name matches", () => {
  const schema = parseKyselySchema([
    {
      path: "database.ts",
      content: `export interface EventTable {
  id: Generated<number>;
  tenant_id: number;
}

export interface Database {
  events: EventTable;
}`,
    },
  ]);
  assert.equal(schema.tables[0].columns.find((column) => column.key === "tenant_id")!.reference, undefined);
});

test("uses the interface name without a Database map", () => {
  const schema = parseKyselySchema([
    {
      path: "database.ts",
      content: `export interface Widget {
  id: Generated<number>;
  label: string;
}`,
    },
  ]);
  assert.equal(schema.tables[0].id, "Widget");
  assert.equal(schema.tables[0].name, "Widget");
});
