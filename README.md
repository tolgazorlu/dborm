# ORMLens

A dbdiagram.io-style tool that turns ORM schema code into a live ER diagram and
analyzes it with AI. Built on Next.js App Router, React Flow, ts-morph and the
Vercel AI SDK (Google Gemini).

**Supported ORMs:** Drizzle · Prisma · TypeORM · MikroORM · Sequelize ·
Kysely · Mongoose (via the header selector)
**Languages:** Türkçe · English
**Theme:** dark · light

- **Left**: Monaco editor (file tabs vary per ORM)
- **Center**: React Flow canvas — tables are nodes, references are edges
- **Right**: deterministic rule engine + streaming AI analysis

The page itself never scrolls: the header is fixed and each of the three panes
scrolls on its own.

## Setup

```bash
npm install
cp .env.example .env.local   # add GOOGLE_GENERATIVE_AI_API_KEY (optional)
npm run dev
```

The app works fully without a key; only the "AI analysis" tab returns an error.
The parser, rule engine, diagram and sharing all work without one. Get a key at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey).

Quota and limit settings live in `.env.example` and are all optional.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Parser tests (60 tests, node:test + tsx) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Architecture

```
proxy.ts                    CSP header + per-request nonce
app/
  layout.tsx                Theme script (flash prevention) + locale cookie + providers
  page.tsx                  Opens the workspace
  s/[token]/page.tsx        One-time link — confirmation screen
  api/parse/route.ts        Code -> ParsedSchema + static findings
  api/analyze/route.ts      ParsedSchema -> streaming AI analysis (Gemini)
  api/share/…               Create / check / open a one-time link
components/
  workspace.tsx             Client orchestrator (ORM, tabs, layout)
  i18n-provider.tsx         Locale context (cookie based)
  theme-provider.tsx        data-theme + localStorage
  editor/schema-editor.tsx  Monaco + custom syntax theme + Prisma tokenizer
  canvas/                   React Flow canvas and table node
  panels/                   Finding card, rule engine panel, AI panel
  share/                    Share dialog and reveal screen
lib/
  orm/
    types.ts                The common ParsedSchema every ORM produces
    catalog.ts              Client-side ORM list, file tabs, samples
    parse.ts                Server-side dispatcher
    ts-project.ts           Shared ts-morph setup for TS-based ORMs
    validate.ts             ORM-agnostic structural validation
    decorators.ts           Shared decorator readers for TypeORM/MikroORM
    drizzle/ prisma/ typeorm/ mikroorm/ sequelize/ kysely/ mongoose/
  flow/                     ParsedSchema -> nodes/edges + dagre layout
  analysis/                 Deterministic rule engine
  ai/                       Zod schema, prompt, schema digest
  i18n/                     Dictionaries, locale helpers
  share/store.ts            One-time record store
  security/                 Quota counters, IP key, size-limited body reader
  storage/workspace.ts      Workspace persistence in localStorage
  theme/read-palette.ts     Reads CSS variables for Monaco/React Flow
```

### Adding a new ORM

1. Write a parser with the signature `(files, locale) => ParsedSchema` in
   `lib/orm/<orm>/index.ts`. For TypeScript-based ORMs use `createTsProject` +
   `ast-utils`; for a custom DSL, the block reader in the Prisma parser is the
   pattern to follow.
2. Add the id to `ORM_IDS` in `lib/orm/types.ts`.
3. Add a sample schema to `lib/orm/samples.ts` and the label plus file tabs to
   `catalog.ts`.
4. Wire the parser into the map in `lib/orm/parse.ts`.

The diagram, rule engine and AI layer only know about `ParsedSchema`, so
nothing else needs to change.

### Why does the parser run on the server?

`ts-morph` pulls in the TypeScript compiler (~6 MB). Putting that in the client
bundle would badly slow the first load. Since `lib/orm/*` are pure functions,
running them in the browser only takes calling the same functions inside a Web
Worker — no UI changes required.

### Colors and diagram metrics live in one place

The whole palette sits in CSS variables in `app/globals.css`. Monaco and React
Flow do not accept CSS classes, so colors are read from there with
`getComputedStyle` (`lib/theme/read-palette.ts`).

One trap: the CSS compiler shortens hex colors (`#ffffff` -> `#fff`) while
Monaco only accepts 6/8-digit hex and throws otherwise. The read layer expands
the short form back.

Node sizes and handle positions are computed in `lib/flow/constants.ts` and
written onto the node object. If you do not provide them, React Flow leaves
measurement entirely to `ResizeObserver`; when no measurement arrives **no edges
are drawn at all**. Since the values are already known there is no need for
measurement — fitting the view is hand-computed instead of `fitView` for the
same reason.

## Quota and error policy

An AI call spends a paid external quota directly, so `/api/analyze` goes
through a three-layer counter (`lib/security/quota.ts`):

| Layer | Default | Purpose |
| --- | --- | --- |
| IP / minute | 3 | Stops button mashing |
| IP / day | 15 | Per-person share |
| Total / day | 400 | The real brake — this protects the bill |

Parsing (120/min), share creation (20/hour) and link opening (60/hour) are
limited too; the first two burn CPU, the third burns disk. Counters are keyed by
a **salted SHA-256 digest of the IP**: equality is all that is needed, so the raw
IP is never stored. Windows are fixed and aligned to UTC, meaning "daily" really
does reset at the start of the day.

Storage is in process memory — the same trade-off as `lib/share/store.ts`. **On
a multi-instance/serverless deployment each instance keeps its own counter**; in
that case swap `lib/security/rate-limit.ts` for Upstash/Redis, the
`createRateLimiter` interface can stay the same.

### Why does every error say "daily limit reached"?

Whatever goes wrong on the model side — quota exhausted, invalid key, a provider
503, JSON that breaks mid-stream — the user sees a single 429 and a single
message. The outcome is the same for them anyway, and the technical detail would
only leak information about the server's configuration ("is a key set? which
model? which provider?"). The real error goes to the server log, and in
development it also reaches the screen.

Two implementation details make this work:

- **The stream is not opened until the first chunk arrives.** The 200 headers
  are sent the moment `createTextStreamResponse` is called; if the model fails
  after that the status code can no longer change and the client receives an
  empty body. Waiting for the first chunk up front turns that case into a proper
  429 — with no added latency, since the user is waiting for the first token
  regardless.
- **If the primary model cannot start, a fallback takes over.** The large flash
  models occasionally return a "high demand" 503; `AI_FALLBACK_MODEL` steps in
  and delivers the analysis anyway.

## Security

- **CSP** is set up in `proxy.ts` with a per-request nonce (`'strict-dynamic'`).
  Monaco loads from the jsdelivr CDN and Clarity from its own domain; both are
  scripts started via `createElement` by a nonce'd script, so they are allowed,
  while an injected `<script>` cannot know the nonce and never runs. `style-src`
  deliberately keeps `'unsafe-inline'`: Monaco emits its theme as runtime
  `<style>` tags.
- **Static headers** live in `next.config.ts`: `nosniff`, `X-Frame-Options:
  DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS,
  `poweredByHeader: false`.
- **Body size** is counted while the stream is read and aborted the moment the
  cap is passed (`lib/security/body.ts`). App Router has no equivalent of
  `bodyParser.sizeLimit`, and `await request.json()` buffers the whole body.
- **The share token never reaches Clarity.** The token sits in the address bar
  and Clarity records page URLs, so analytics is not loaded at all on `/s/...`
  pages.
- **Schema content reaches the model only after parsing.** The JSON sent by the
  client is not trusted; the server runs the same parser again.

## Analytics

Microsoft Clarity is loaded with `next/script` in
`components/analytics/clarity.tsx`. It is disabled in development and on
`/s/<token>` pages.

The script tag's `id` **must not be "clarity"** — the browser puts elements with
an id onto `window` under the same name, which stops Clarity's queue function
from being created and makes the library fail with `a[c] is not a function`.

## Locale and theme

The theme is kept in `localStorage`, the locale in a cookie. The split is
deliberate:

- **Theme** is an attribute (`<html data-theme>`) that an inline script can fix
  before the first paint — no flash.
- **Locale** changes the text itself. Read from `localStorage`, the HTML
  produced by the server would not match the client's text and every text node
  would raise a hydration error. A cookie travels with the request, so the
  server renders in the right language.

Server-produced text (parser diagnostics, rule engine findings, AI output) is
locale-aware too: the locale travels with the request.

## Where is the workspace stored?

The schema in the editor is written to `localStorage`
(`ormlens:workspace:v1`) with a 500 ms debounce. The content survives closing
the tab; **Reset** in the header clears the record and restores the samples.

Not a cookie, because a cookie travels to the server on every HTTP request and
is limited to about 4 KB in practice — while this content is user code that can
reach 256 KB. The server does not need the data; keeping it in a cookie would
only mean wasted bandwidth and data leaking into server logs. (The locale
preference is a cookie for the opposite reason: the server needs it on the first
render.)

Restoring happens in a `useEffect` rather than during render: `localStorage`
does not exist on the server, and reading it during the first render would cause
a hydration mismatch. The stored value is always validated — the key is
something the user can edit by hand, so its contents are treated as untrusted
input.

Restoring is skipped when the page was opened from a share link: what the user
wants to see right then is the schema behind the link. As they edit, that
content starts being saved too.

## One-time share link

**Share** in the header produces a link that carries the schema (and which ORM
it is) to `/s/<token>`. The link can be opened **once**: the content is deleted
from the server the moment it is read, and a second visit shows the "already
used" screen. Unopened links delete themselves after 24 hours.

Two design details:

- **GET does not consume.** Link previews in messaging apps and browser
  prefetching both issue a GET; if content were revealed on GET the link would
  burn before the user ever saw it. So the page shows a confirmation screen
  first and the content is only revealed by a user-triggered POST.
- **The one-time guarantee comes from `rename`.** Rename is atomic on POSIX, so
  out of two concurrent requests only one takes the record.

Storage is the file system (`.data/shares`, not committed) so that no external
dependency is required. It is correct on a single-process server (dev,
`next start`, Docker). **On serverless each instance sees its own disk, so in
production replace `lib/share/store.ts` with Redis/Vercel KV**; the four
exported functions can stay the same.

## Supported syntax

The scope is pinned by tests in `lib/orm/*/**.test.ts`.

**Drizzle** — `pgTable`/`mysqlTable`/`sqliteTable` (dialect detected
automatically), named and unnamed columns, chained methods (`primaryKey`,
`notNull`, `unique`, `default*`, `array`, `references`), both the array and
object form of the third argument (`index`, `uniqueIndex`,
`primaryKey({columns})`, `foreignKey({...})`), `pgEnum` and inline
`{ enum: [...] }`, `relations()` blocks.

**Prisma** — dialect from the `datasource` provider, `model`/`enum`/`view`
blocks, `@id`/`@unique`/`@default`/`@map`/`@db.*`/`@relation`,
`@@map`/`@@id`/`@@index`/`@@unique`, optional (`?`) and list (`[]`) fields. A
relation field is distinguished from a foreign key column: only the latter shows
up as a column in the diagram.

**TypeORM** — `@Entity` classes, `@PrimaryGeneratedColumn`/`@PrimaryColumn`/
`@Column` options, the `@CreateDateColumn` family, type inference from the TS
type, class-level and field-level `@Index`/`@Unique`,
`@ManyToOne`/`@OneToMany`/`@OneToOne`/`@ManyToMany`, `@JoinColumn({ name })`.
The same distinction as Prisma: a relation field is not a column, the foreign
key is a separate field.

**MikroORM** — `@Entity({ tableName })`, `@PrimaryKey`/`@Property`/`@Enum`
options, `@Index`/`@Unique({ properties })`, relation decorators. Key
difference: a `@ManyToOne` field **is itself** the foreign key column.

**Sequelize** — `sequelize.define(...)` and `class X extends Model` +
`X.init(...)`, both shorthand (`DataTypes.STRING`) and long attribute forms,
`field`/`allowNull`/`unique`/`primaryKey`/`autoIncrement`/`defaultValue`/
`references`, `tableName`, `indexes`, default `timestamps` and the implicit
`id`; `belongsTo`/`hasMany`/`hasOne`/`belongsToMany` calls (the foreign key
column is added when the schema does not declare it).

**Kysely** — table interfaces, table names from the `Database` map,
`Generated<>` and `ColumnType<>` wrappers, nullability via `| null` and `?`,
array types. Since the Kysely type layer carries no relations, foreign keys are
only inferred **when a column name matches a table name** (`user_id` -> `users`),
drawn with a dashed line, and constraint checks such as "missing onDelete" are
not applied to those references.

**Mongoose** — `new Schema({...}, {...})`, the `mongoose.model('Name', schema)`
mapping, shorthand (`String`) and long (`{ type: String, required: true }`)
field forms, relations via `ref`, `enum`, `unique`, `index: true`,
`schema.index()`, `timestamps`, embedded subdocuments, the implicit `_id`.
