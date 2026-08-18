import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSequelizeSchema } from "./index";

const SCHEMA = `import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize(process.env.DATABASE_URL);

export const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    role: { type: DataTypes.ENUM('admin', 'viewer'), defaultValue: 'viewer' },
    fullName: { type: DataTypes.STRING, field: 'full_name' },
  },
  { tableName: 'users' },
);

export const Post = sequelize.define(
  'Post',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    content: DataTypes.TEXT,
  },
  { tableName: 'posts', indexes: [{ name: 'posts_author_idx', fields: ['authorId'] }] },
);

Post.belongsTo(User, { foreignKey: 'authorId', onDelete: 'CASCADE' });
User.hasMany(Post, { foreignKey: 'authorId' });
`;

function parse() {
  return parseSequelizeSchema([{ path: "models.ts", content: SCHEMA }]);
}

test("turns define calls into tables", () => {
  const schema = parse();
  assert.equal(schema.orm, "sequelize");
  assert.deepEqual(
    schema.tables.map((table) => `${table.id}:${table.name}`),
    ["User:users", "Post:posts"],
  );
});

test("reads attribute options and the shorthand form", () => {
  const user = parse().tables.find((table) => table.id === "User")!;

  const id = user.columns[0];
  assert.equal(id.isPrimaryKey, true);
  assert.equal(id.hasDefault, true);

  const email = user.columns.find((column) => column.key === "email")!;
  assert.equal(email.displayType, "STRING(255)");
  assert.equal(email.isNotNull, true);
  assert.equal(email.isUnique, true);

  assert.deepEqual(user.columns.find((column) => column.key === "role")!.enumValues, [
    "admin",
    "viewer",
  ]);
  assert.equal(user.columns.find((column) => column.key === "fullName")!.name, "full_name");

  const post = parse().tables.find((table) => table.id === "Post")!;
  assert.equal(post.columns.find((column) => column.key === "content")!.type, "TEXT");
});

test("timestamps are on by default", () => {
  const user = parse().tables.find((table) => table.id === "User")!;
  assert.ok(user.columns.some((column) => column.key === "createdAt"));
  assert.ok(user.columns.some((column) => column.key === "updatedAt"));
});

test("timestamps: false verilirse eklenmez", () => {
  const schema = parseSequelizeSchema([
    {
      path: "models.ts",
      content: `export const A = sequelize.define('A', { id: { type: DataTypes.INTEGER, primaryKey: true } }, { timestamps: false });`,
    },
  ]);
  assert.deepEqual(
    schema.tables[0].columns.map((column) => column.key),
    ["id"],
  );
});

test("adds an implicit id when no primary key is given", () => {
  const schema = parseSequelizeSchema([
    {
      path: "models.ts",
      content: `export const A = sequelize.define('A', { name: DataTypes.STRING }, { timestamps: false });`,
    },
  ]);
  assert.deepEqual(
    schema.tables[0].columns.map((column) => column.key),
    ["id", "name"],
  );
  assert.equal(schema.tables[0].columns[0].isPrimaryKey, true);
});

test("belongsTo adds the foreign key to the source", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;
  const authorId = post.columns.find((column) => column.key === "authorId")!;

  assert.deepEqual(authorId.reference, {
    table: "User",
    column: "id",
    onDelete: "cascade",
    isComposite: false,
  });
});

test("collects relations and model indexes", () => {
  const schema = parse();
  assert.deepEqual(
    schema.relations.map((relation) => `${relation.sourceTable}.${relation.fieldName}:${relation.kind}`),
    ["Post.belongsTo:one", "User.hasMany:many"],
  );
  assert.deepEqual(schema.tables[1].indexes, [
    { name: "posts_author_idx", columns: ["authorId"], isUnique: false },
  ]);
});

test("supports the class + init form as well", () => {
  const schema = parseSequelizeSchema([
    {
      path: "models.ts",
      content: `class Product extends Model {}
Product.init(
  { id: { type: DataTypes.INTEGER, primaryKey: true } },
  { sequelize, modelName: 'Product', tableName: 'products', timestamps: false },
);`,
    },
  ]);
  assert.equal(schema.tables[0].id, "Product");
  assert.equal(schema.tables[0].name, "products");
});
