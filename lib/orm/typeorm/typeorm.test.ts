import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTypeOrmSchema } from "./index";

const SCHEMA = `import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ type: 'enum', enum: ['admin', 'viewer'], default: 'viewer' })
  role: string;

  @Column({ nullable: true })
  bio: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}

@Entity('posts')
@Index('posts_slug_idx', ['slug'])
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  title: string;

  @Column()
  slug: string;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Index()
  @Column({ name: 'author_id' })
  authorId: number;
}
`;

function parse() {
  return parseTypeOrmSchema([{ path: "entities.ts", content: SCHEMA }]);
}

test("@Entity sınıflarını tabloya çevirir", () => {
  const schema = parse();
  assert.equal(schema.orm, "typeorm");
  assert.deepEqual(
    schema.tables.map((table) => `${table.id}:${table.name}`),
    ["User:users", "Post:posts"],
  );
});

test("ilişki alanı kolon değildir, yabancı anahtar ayrı alandadır", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;

  assert.deepEqual(
    post.columns.map((column) => column.key),
    ["id", "title", "slug", "authorId"],
  );

  const authorId = post.columns.find((column) => column.key === "authorId")!;
  assert.equal(authorId.name, "author_id");
  assert.deepEqual(authorId.reference, {
    table: "User",
    column: "id",
    onDelete: "cascade",
    isComposite: false,
  });
});

test("kolon seçeneklerini ve TS tiplerini okur", () => {
  const user = parse().tables.find((table) => table.id === "User")!;

  const id = user.columns[0];
  assert.equal(id.isPrimaryKey, true);
  assert.equal(id.hasDefault, true);

  const email = user.columns.find((column) => column.key === "email")!;
  assert.equal(email.displayType, "varchar(255)");
  assert.equal(email.isUnique, true);
  assert.equal(email.isNotNull, true);

  const role = user.columns.find((column) => column.key === "role")!;
  assert.deepEqual(role.enumValues, ["admin", "viewer"]);

  // TypeORM'de kolonlar varsayılan olarak NOT NULL'dur.
  assert.equal(user.columns.find((column) => column.key === "bio")!.isNotNull, false);

  const createdAt = user.columns.find((column) => column.key === "createdAt")!;
  assert.equal(createdAt.name, "created_at");
  assert.equal(createdAt.type, "timestamp");
  assert.equal(createdAt.hasDefault, true);
});

test("sınıf ve alan seviyesindeki index'leri toplar", () => {
  const post = parse().tables.find((table) => table.id === "Post")!;
  assert.deepEqual(post.indexes, [
    { name: "posts_slug_idx", columns: ["slug"], isUnique: false },
    { columns: ["authorId"], isUnique: false },
  ]);
});

test("one ve many ilişkilerini kurar", () => {
  const { relations } = parse();
  assert.deepEqual(
    relations.map((relation) => `${relation.id}:${relation.kind}`),
    ["User.posts:many", "Post.author:one"],
  );
  assert.deepEqual(relations[1].fields, ["authorId"]);
});

test("DataSource tanımından lehçeyi çıkarır", () => {
  const schema = parseTypeOrmSchema([
    {
      path: "entities.ts",
      content: `export const dataSource = new DataSource({ type: 'postgres', url: '' });
@Entity('a')
export class A { @PrimaryGeneratedColumn() id: number; }`,
    },
  ]);
  assert.equal(schema.dialect, "pg");
});

test("sözdizimi hatasında çökmez", () => {
  const schema = parseTypeOrmSchema([{ path: "entities.ts", content: "@Entity() export class {" }]);
  assert.ok(schema.diagnostics.some((item) => item.level === "error"));
});
