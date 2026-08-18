import type { OrmId } from "./types";

const DRIZZLE_SCHEMA = `import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  varchar,
  boolean,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'editor', 'viewer']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: roleEnum('role').default('viewer').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    content: text('content'),
    published: boolean('published').default(false).notNull(),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('posts_slug_idx').on(table.slug)],
);

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  body: text('body').notNull(),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
`;

const DRIZZLE_RELATIONS = `import { relations } from 'drizzle-orm';
import { users, posts, comments } from './schema';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
`;

const PRISMA_SCHEMA = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  EDITOR
  VIEWER
}

model User {
  id        Int       @id @default(autoincrement())
  name      String    @db.VarChar(255)
  email     String    @unique @db.VarChar(255)
  role      Role      @default(VIEWER)
  createdAt DateTime  @default(now()) @map("created_at")
  posts     Post[]
  comments  Comment[]

  @@map("users")
}

model Post {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(255)
  slug      String    @unique @db.VarChar(255)
  content   String?
  published Boolean   @default(false)
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  Int       @map("author_id")
  createdAt DateTime  @default(now()) @map("created_at")
  comments  Comment[]

  @@map("posts")
  @@index([authorId])
}

model Comment {
  id        Int      @id @default(autoincrement())
  body      String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId    Int      @map("post_id")
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  Int      @map("author_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("comments")
}
`;

const MONGOOSE_SCHEMA = `import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'viewer' },
  },
  { timestamps: true },
);

const postSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: String,
    published: { type: Boolean, default: false },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tags: [String],
  },
  { timestamps: true },
);

postSchema.index({ author: 1, createdAt: -1 });

const commentSchema = new Schema(
  {
    body: { type: String, required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
export const Post = mongoose.model('Post', postSchema);
export const Comment = mongoose.model('Comment', commentSchema);
`;

const TYPEORM_SCHEMA = `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ type: 'enum', enum: ['admin', 'editor', 'viewer'], default: 'viewer' })
  role: string;

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

  @Column({ length: 255 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ default: false })
  published: boolean;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Index()
  @Column({ name: 'author_id' })
  authorId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];
}

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  body: string;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @Column({ name: 'post_id' })
  postId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'author_id' })
  authorId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
`;

const MIKROORM_SCHEMA = `import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Enum,
  Index,
} from '@mikro-orm/core';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey()
  id!: number;

  @Property({ length: 255 })
  name!: string;

  @Property({ length: 255, unique: true })
  email!: string;

  @Enum({ items: ['admin', 'editor', 'viewer'], default: 'viewer' })
  role!: string;

  @Property({ fieldName: 'created_at', defaultRaw: 'now()' })
  createdAt!: Date;

  @OneToMany(() => Post, (post) => post.author)
  posts = new Collection<Post>(this);
}

@Entity({ tableName: 'posts' })
export class Post {
  @PrimaryKey()
  id!: number;

  @Property({ length: 255 })
  title!: string;

  @Property({ length: 255, unique: true })
  slug!: string;

  @Property({ type: 'text', nullable: true })
  content?: string;

  @Property({ default: false })
  published!: boolean;

  @Index()
  @ManyToOne(() => User, { fieldName: 'author_id', deleteRule: 'cascade' })
  author!: User;

  @Property({ fieldName: 'created_at', defaultRaw: 'now()' })
  createdAt!: Date;

  @OneToMany(() => Comment, (comment) => comment.post)
  comments = new Collection<Comment>(this);
}

@Entity({ tableName: 'comments' })
export class Comment {
  @PrimaryKey()
  id!: number;

  @Property({ type: 'text' })
  body!: string;

  @ManyToOne(() => Post, { fieldName: 'post_id', deleteRule: 'cascade' })
  post!: Post;

  @ManyToOne(() => User, { fieldName: 'author_id', deleteRule: 'cascade' })
  author!: User;

  @Property({ fieldName: 'created_at', defaultRaw: 'now()' })
  createdAt!: Date;
}
`;

const SEQUELIZE_SCHEMA = `import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize(process.env.DATABASE_URL);

export const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    role: {
      type: DataTypes.ENUM('admin', 'editor', 'viewer'),
      allowNull: false,
      defaultValue: 'viewer',
    },
  },
  { tableName: 'users' },
);

export const Post = sequelize.define(
  'Post',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    content: { type: DataTypes.TEXT },
    published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: 'posts',
    indexes: [{ name: 'posts_author_idx', fields: ['authorId'] }],
  },
);

export const Comment = sequelize.define(
  'Comment',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    body: { type: DataTypes.TEXT, allowNull: false },
  },
  { tableName: 'comments' },
);

Post.belongsTo(User, { foreignKey: 'authorId', onDelete: 'CASCADE' });
User.hasMany(Post, { foreignKey: 'authorId' });

Comment.belongsTo(Post, { foreignKey: 'postId', onDelete: 'CASCADE' });
Post.hasMany(Comment, { foreignKey: 'postId' });

Comment.belongsTo(User, { foreignKey: 'authorId', onDelete: 'CASCADE' });
User.hasMany(Comment, { foreignKey: 'authorId' });
`;

const KYSELY_SCHEMA = `import { Generated, ColumnType } from 'kysely';

export interface UserTable {
  id: Generated<number>;
  name: string;
  email: string;
  role: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PostTable {
  id: Generated<number>;
  title: string;
  slug: string;
  content: string | null;
  published: Generated<boolean>;
  user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface CommentTable {
  id: Generated<number>;
  body: string;
  post_id: number;
  user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
}

// Kysely does not express relations in the type layer. ORMLens only infers them
// when a column name matches a table name (user_id -> users) and draws them with
// a dashed line, i.e. as a guess.
export interface Database {
  users: UserTable;
  posts: PostTable;
  comments: CommentTable;
}
`;

export const ORM_SAMPLES: Record<OrmId, Record<string, string>> = {
  drizzle: { schema: DRIZZLE_SCHEMA, relations: DRIZZLE_RELATIONS },
  prisma: { schema: PRISMA_SCHEMA },
  typeorm: { schema: TYPEORM_SCHEMA },
  mikroorm: { schema: MIKROORM_SCHEMA },
  sequelize: { schema: SEQUELIZE_SCHEMA },
  kysely: { schema: KYSELY_SCHEMA },
  mongoose: { schema: MONGOOSE_SCHEMA },
};
