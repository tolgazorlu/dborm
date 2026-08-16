import assert from "node:assert/strict";
import { test } from "node:test";

import { parseMongooseSchema } from "./index";

const SCHEMA = `import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ['admin', 'viewer'], default: 'viewer' },
  },
  { timestamps: true },
);

const postSchema = new Schema({
  title: { type: String, required: true },
  content: String,
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tags: [String],
  reviewers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
});

postSchema.index({ author: 1, title: -1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
export const Post = mongoose.model('Post', postSchema);
`;

function parse() {
  return parseMongooseSchema([{ path: "models.ts", content: SCHEMA }]);
}

test("model adlarını tablo kimliği olarak kullanır", () => {
  const schema = parse();
  assert.equal(schema.orm, "mongoose");
  assert.equal(schema.dialect, "mongo");
  assert.deepEqual(
    schema.tables.map((table) => table.id),
    ["User", "Post"],
  );
});

test("örtük _id ve timestamps kolonlarını ekler", () => {
  const user = parse().tables.find((table) => table.id === "User")!;

  assert.equal(user.columns[0].key, "_id");
  assert.equal(user.columns[0].isPrimaryKey, true);
  assert.deepEqual(
    user.columns.map((column) => column.key),
    ["_id", "name", "email", "role", "createdAt", "updatedAt"],
  );
});

test("required, unique, default ve enum tanımlarını okur", () => {
  const user = parse().tables.find((table) => table.id === "User")!;

  const email = user.columns.find((column) => column.key === "email")!;
  assert.equal(email.type, "String");
  assert.equal(email.isNotNull, true);
  assert.equal(email.isUnique, true);

  const role = user.columns.find((column) => column.key === "role")!;
  assert.deepEqual(role.enumValues, ["admin", "viewer"]);
  assert.equal(role.hasDefault, true);
});

test("kısa tip yazımını ve dizi alanlarını destekler", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;

  const content = post.columns.find((column) => column.key === "content")!;
  assert.equal(content.type, "String");
  assert.equal(content.isNotNull, false);

  const tags = post.columns.find((column) => column.key === "tags")!;
  assert.equal(tags.isArray, true);
  assert.equal(tags.displayType, "String[]");
});

test("ref alanlarını referansa ve ilişkiye çevirir", () => {
  const schema = parse();
  const post = schema.tables.find((table) => table.id === "Post")!;

  const author = post.columns.find((column) => column.key === "author")!;
  assert.equal(author.type, "ObjectId");
  assert.deepEqual(author.reference, { table: "User", column: "_id", isComposite: false });

  const reviewers = post.columns.find((column) => column.key === "reviewers")!;
  assert.equal(reviewers.isArray, true);
  assert.equal(reviewers.reference?.table, "User");

  assert.deepEqual(
    schema.relations.map((relation) => `${relation.id}:${relation.kind}`),
    ["Post.author:one", "Post.reviewers:many"],
  );
});

test("schema.index() çağrılarını okur", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;
  assert.deepEqual(post.indexes, [
    { name: undefined, columns: ["author", "title"], isUnique: true },
  ]);
});

test("index: true kısayolunu da index sayar", () => {
  const schema = parseMongooseSchema([
    {
      path: "models.ts",
      content: `const s = new Schema({ slug: { type: String, index: true } });
export const S = mongoose.model('Thing', s);`,
    },
  ]);
  assert.deepEqual(schema.tables[0].indexes, [{ columns: ["slug"], isUnique: false }]);
});

test("collection seçeneği verilirse koleksiyon adını kullanır", () => {
  const schema = parseMongooseSchema([
    {
      path: "models.ts",
      content: `const s = new Schema({ a: String }, { collection: 'legacy_things' });
export const S = mongoose.model('Thing', s);`,
    },
  ]);
  assert.equal(schema.tables[0].id, "Thing");
  assert.equal(schema.tables[0].name, "legacy_things");
});

test("gömülü alt belgeleri Object olarak gösterir", () => {
  const schema = parseMongooseSchema([
    {
      path: "models.ts",
      content: `const s = new Schema({ address: { street: String, city: String } });
export const S = mongoose.model('Person', s);`,
    },
  ]);
  assert.equal(schema.tables[0].columns[1].displayType, "Object");
});

test("model() çağrısı yoksa değişken adına düşer", () => {
  const schema = parseMongooseSchema([
    { path: "models.ts", content: `const orphanSchema = new Schema({ a: String });` },
  ]);
  assert.equal(schema.tables[0].id, "orphanSchema");
});

test("sözdizimi hatasında çökmez", () => {
  const schema = parseMongooseSchema([{ path: "models.ts", content: "const s = new Schema({" }]);
  assert.ok(schema.diagnostics.some((item) => item.level === "error"));
});
