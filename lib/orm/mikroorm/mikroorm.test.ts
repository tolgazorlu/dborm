import assert from "node:assert/strict";
import { test } from "node:test";

import { parseMikroOrmSchema } from "./index";

const SCHEMA = `import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Enum, Index, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey()
  id!: number;

  @Property({ length: 255, unique: true })
  email!: string;

  @Enum({ items: ['admin', 'viewer'], default: 'viewer' })
  role!: string;

  @Property({ nullable: true })
  bio?: string;

  @OneToMany(() => Post, (post) => post.author)
  posts = new Collection<Post>(this);
}

@Entity({ tableName: 'posts' })
@Unique({ properties: ['slug'] })
export class Post {
  @PrimaryKey()
  id!: number;

  @Property({ length: 255 })
  slug!: string;

  @Index()
  @ManyToOne(() => User, { fieldName: 'author_id', deleteRule: 'cascade' })
  author!: User;

  @Property({ fieldName: 'created_at', defaultRaw: 'now()' })
  createdAt!: Date;
}
`;

function parse() {
  return parseMikroOrmSchema([{ path: "entities.ts", content: SCHEMA }]);
}

test("entity sınıflarını ve tablo adlarını okur", () => {
  const schema = parse();
  assert.equal(schema.orm, "mikroorm");
  assert.deepEqual(
    schema.tables.map((table) => `${table.id}:${table.name}`),
    ["User:users", "Post:posts"],
  );
});

test("@ManyToOne alanı hem kolon hem ilişkidir", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;

  assert.deepEqual(
    post.columns.map((column) => column.key),
    ["id", "slug", "author", "createdAt"],
  );

  const author = post.columns.find((column) => column.key === "author")!;
  assert.equal(author.name, "author_id");
  assert.deepEqual(author.reference, {
    table: "User",
    column: "id",
    onDelete: "cascade",
    isComposite: false,
  });
});

test("property seçeneklerini okur", () => {
  const user = parse().tables.find((table) => table.id === "User")!;

  const email = user.columns.find((column) => column.key === "email")!;
  assert.equal(email.displayType, "varchar(255)");
  assert.equal(email.isUnique, true);
  assert.equal(email.isNotNull, true);

  assert.deepEqual(user.columns.find((column) => column.key === "role")!.enumValues, [
    "admin",
    "viewer",
  ]);
  assert.equal(user.columns.find((column) => column.key === "bio")!.isNotNull, false);

  const createdAt = parse().tables[1].columns.find((column) => column.key === "createdAt")!;
  assert.equal(createdAt.name, "created_at");
  assert.equal(createdAt.hasDefault, true);
});

test("@Unique ve @Index dekoratörlerini toplar", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;
  assert.deepEqual(post.indexes, [
    { name: undefined, columns: ["slug"], isUnique: true },
    { columns: ["author"], isUnique: false },
  ]);
});

test("ilişkileri iki yönlü kurar", () => {
  const { relations } = parse();
  assert.deepEqual(
    relations.map((relation) => `${relation.id}:${relation.kind}`),
    ["User.posts:many", "Post.author:one"],
  );
});

test("çoklu birincil anahtarı bileşik sayar", () => {
  const schema = parseMikroOrmSchema([
    {
      path: "entities.ts",
      content: `@Entity()
export class Membership {
  @PrimaryKey()
  userId!: number;

  @PrimaryKey()
  orgId!: number;
}`,
    },
  ]);
  assert.deepEqual(schema.tables[0].compositePrimaryKey, ["userId", "orgId"]);
});
