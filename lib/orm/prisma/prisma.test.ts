import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePrismaSchema } from "./index";

const SCHEMA = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  VIEWER
}

/// Kullanıcılar
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique @db.VarChar(255)
  role      Role     @default(VIEWER)
  createdAt DateTime @default(now()) @map("created_at")
  posts     Post[]

  @@map("users")
}

model Post {
  id       Int     @id @default(autoincrement())
  title    String  @db.VarChar(255)
  content  String?
  tags     String[]
  author   User    @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId Int     @map("author_id")

  @@map("posts")
  @@index([authorId])
}
`;

function parse() {
  return parsePrismaSchema([{ path: "schema.prisma", content: SCHEMA }]);
}

test("provider'dan lehçeyi ve modellerden tabloları çıkarır", () => {
  const schema = parse();
  assert.equal(schema.orm, "prisma");
  assert.equal(schema.dialect, "pg");
  assert.deepEqual(
    schema.tables.map((table) => table.id),
    ["User", "Post"],
  );
  // @@map, veritabanındaki gerçek adı belirler.
  assert.deepEqual(
    schema.tables.map((table) => table.name),
    ["users", "posts"],
  );
});

test("ilişki alanını kolon saymaz, yabancı anahtar kolonunu işaretler", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;

  assert.deepEqual(
    post.columns.map((column) => column.key),
    ["id", "title", "content", "tags", "authorId"],
  );

  const authorId = post.columns.find((column) => column.key === "authorId")!;
  assert.equal(authorId.name, "author_id");
  assert.deepEqual(authorId.reference, {
    table: "User",
    column: "id",
    onDelete: "cascade",
    onUpdate: undefined,
    isComposite: true,
  });
});

test("öznitelikleri ve tipleri okur", () => {
  const user = parse().tables.find((table) => table.id === "User")!;

  const id = user.columns[0];
  assert.equal(id.isPrimaryKey, true);
  assert.equal(id.hasDefault, true);

  const email = user.columns.find((column) => column.key === "email")!;
  assert.equal(email.isUnique, true);
  assert.equal(email.isNotNull, true);
  assert.equal(email.displayType, "VarChar(255)");

  const role = user.columns.find((column) => column.key === "role")!;
  assert.equal(role.displayType, "enum(Role)");
  assert.deepEqual(role.enumValues, ["ADMIN", "VIEWER"]);

  const createdAt = user.columns.find((column) => column.key === "createdAt")!;
  assert.equal(createdAt.name, "created_at");
});

test("opsiyonel ve liste alanlarını ayırt eder", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;
  assert.equal(post.columns.find((column) => column.key === "content")!.isNotNull, false);

  const tags = post.columns.find((column) => column.key === "tags")!;
  assert.equal(tags.isArray, true);
  assert.equal(tags.displayType, "String[]");
});

test("blok özniteliklerinden index çıkarır", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;
  assert.deepEqual(post.indexes, [{ name: undefined, columns: ["authorId"], isUnique: false }]);
});

test("one ve many ilişkilerini kurar", () => {
  const { relations } = parse();
  assert.deepEqual(
    relations.map((relation) => `${relation.id}:${relation.kind}`),
    ["User.posts:many", "Post.author:one"],
  );

  const one = relations.find((relation) => relation.id === "Post.author")!;
  assert.equal(one.targetTable, "User");
  assert.deepEqual(one.fields, ["authorId"]);
  assert.deepEqual(one.references, ["id"]);
});

test("örnek şema yapısal uyarı üretmez", () => {
  assert.deepEqual(
    parse().diagnostics.filter((item) => item.level !== "info"),
    [],
  );
});

test("kapatılmamış blok hata teşhisi verir", () => {
  const schema = parsePrismaSchema([
    { path: "schema.prisma", content: "model User {\n  id Int @id" },
  ]);
  assert.ok(schema.diagnostics.some((item) => item.level === "error"));
});

test("yorum satırlarını yok sayar, tırnak içindeki // değil", () => {
  const schema = parsePrismaSchema([
    {
      path: "schema.prisma",
      content: `model Asset {
  id  Int    @id
  // bu bir yorum
  url String @default("https://cdn.example.com//assets")
}`,
    },
  ]);

  const asset = schema.tables[0];
  assert.deepEqual(
    asset.columns.map((column) => column.key),
    ["id", "url"],
  );
  assert.equal(asset.columns[1].hasDefault, true);
});

test("bileşik anahtar ve unique bloklarını okur", () => {
  const schema = parsePrismaSchema([
    {
      path: "schema.prisma",
      content: `model Membership {
  userId Int
  orgId  Int
  role   String

  @@id([userId, orgId])
  @@unique([orgId, role])
}`,
    },
  ]);

  const table = schema.tables[0];
  assert.deepEqual(table.compositePrimaryKey, ["userId", "orgId"]);
  assert.deepEqual(table.indexes, [
    { name: undefined, columns: ["orgId", "role"], isUnique: true },
  ]);
});

test("mongodb provider'ını tanır", () => {
  const schema = parsePrismaSchema([
    {
      path: "schema.prisma",
      content: `datasource db {
  provider = "mongodb"
}

model Event {
  id String @id @default(auto()) @map("_id")
}`,
    },
  ]);
  assert.equal(schema.dialect, "mongo");
});
