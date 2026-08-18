# ORMLens

Paste an ORM schema, get a live ER diagram, a deterministic review and an AI
second opinion. Seven ORMs, one shared schema model, no database connection
required.

**Drizzle · Prisma · TypeORM · MikroORM · Sequelize · Kysely · Mongoose**

- **Editor** — Monaco with per-ORM file tabs and syntax highlighting
- **Diagram** — React Flow canvas; tables are nodes, foreign keys are edges,
  updated as you type
- **Checks** — a deterministic rule engine that finds missing indexes, unsafe
  delete behaviour, secret-looking columns and structural mistakes
- **AI analysis** — an optional streaming review from Google Gemini that
  covers the judgement calls the rule engine cannot make

Nothing is sent anywhere unless you press the AI button. The parser, the
diagram and the rule engine all run on your own server.

Open to everyone by default. Flip one environment variable and it is behind an
email and password instead — see [Authentication](#authentication).

## Quick start

```bash
git clone https://github.com/tolgazorlu/ormlens.git
cd ormlens
pnpm install
cp .env.example .env.local
pnpm dev
```

Open <http://localhost:3000>.

The app is fully usable without any configuration — only the "AI analysis" tab
needs a key. To enable it, get one from
[Google AI Studio](https://aistudio.google.com/apikey) and put it in
`.env.local`:

```
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

npm and yarn work too; pnpm is what the lockfile is built with.

**Requirements:** Node.js 20.9 or newer.

## Deploying

### Docker

```bash
docker build -t ormlens .
docker run -p 3000:3000 \
  -e GOOGLE_GENERATIVE_AI_API_KEY=your-key-here \
  -e AUTH_ENABLED=true \
  -v ormlens-data:/app/.data \
  ormlens
```

The image is a multi-stage build on top of Next.js standalone output and runs
as a non-root user. Standalone output is opt-in through
`NEXT_OUTPUT_STANDALONE=true`, which the Dockerfile sets — leaving it off keeps
the default build that Vercel and other managed platforms expect.

`/app/.data` holds one-time share records and, when authentication is on, the
account and session files. Mount it as a volume so they survive a restart. A
health check is exposed at `/api/health`.

### Node

```bash
pnpm build
pnpm start
```

### Vercel and other serverless platforms

It deploys as-is, but read [Known limitations](SECURITY.md#known-limitations)
first. Three modules assume a single long-lived process **with a writable
disk**:

- `lib/security/rate-limit.ts` keeps rate limit counters in memory
- `lib/share/store.ts` writes share records to the local file system
- `lib/auth/store.ts` writes the account and session records to the same place

On serverless each instance has its own memory, and the project directory is
read-only. Rate limits multiply by instance count, and anything that writes —
creating a share link, first-run setup, signing in — fails outright. All three
modules are small and self-contained; swap them for Redis or a KV store and the
rest of the app does not change.

If you want authentication on a serverless deployment today, seed the account
with `AUTH_EMAIL` and `AUTH_PASSWORD_HASH` so setup never needs to write, and
replace the session half of `lib/auth/store.ts` with your own store.

### Behind a reverse proxy

Rate limiting identifies clients by `x-forwarded-for`. Make sure your proxy sets
it, and set `RATE_LIMIT_IP_HEADER` if it uses a different one:

```
RATE_LIMIT_IP_HEADER=cf-connecting-ip
```

Do not expose the app directly to the internet without a proxy — the header
would be client-controlled and the limits bypassable.

## Authentication

ORMLens ships **open**: anyone who can reach the server can use it. That is the
right default for a tool a team runs on its own network.

If your instance is reachable from the internet and you do not want it used by
strangers, turn on the sign-in gate:

```
AUTH_ENABLED=true
```

With the gate on, everything is protected — the workspace, share pages, and all
data APIs return 401 to unauthenticated callers. The legal pages stay public,
because a privacy policy behind a login is useless.

### First run

The first person to open the app sees a one-time setup screen and creates the
account. Registration closes permanently after that; there is no sign-up page
and no password reset flow.

**Complete this immediately after deploying.** Until the account exists, whoever
reaches the app first can claim it. If there is any gap between deploy and
setup, set a setup key first and only you can complete it:

```
AUTH_SETUP_TOKEN=some-long-random-string
```

### Stateless deployments

The account is stored in `.data/auth/account.json`. If your platform has no
persistent disk, provide the credentials as environment variables instead and
the setup screen is skipped entirely:

```bash
pnpm auth:hash          # prompts for a password, prints AUTH_PASSWORD_HASH=...
```

```
AUTH_EMAIL=you@example.com
AUTH_PASSWORD_HASH=scrypt$15$8$1$...
```

Sessions still need a writable `.data` directory, so this only removes the
account file, not the session store.

### How it is secured

- Passwords are hashed with **scrypt** (N=2^15, r=8, p=1, 64-byte key, random
  16-byte salt per password) using Node's built-in crypto, and compared in
  constant time. No password ever touches disk.
- A failed sign-in against a non-existent account still performs a full hash
  verification, so response timing does not reveal whether an account exists.
- Sessions are **opaque 32-byte random tokens**. Only their SHA-256 digest is
  stored server-side, so a leaked session file cannot be replayed.
- The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS,
  where it also uses the `__Host-` prefix.
- Every auth endpoint verifies that the `Origin` header matches the host, which
  blocks cross-site POSTs on top of `SameSite`.
- Sign-in and setup are rate limited (`AUTH_RATE_LIMIT`, 10 attempts per IP per
  15 minutes).
- Signing out deletes the session record server-side, not just the cookie.

## Legal pages

The app can serve a **Privacy Policy**, a **KVKK disclosure** (Turkish data
protection law) and a **Cookie Policy** at `/legal/privacy`, `/legal/kvkk` and
`/legal/cookies`, in both Turkish and English.

These pages are generated from your configuration, so they describe what your
instance actually does: the cookie table lists the session cookie only when auth
is on, and the analytics sections appear only when analytics is configured.

Set your operator details to activate them and show the "Legal" link in the
header:

```
LEGAL_ENTITY=Your Company Ltd.
LEGAL_CONTACT=privacy@yourcompany.com
LEGAL_ADDRESS=Optional postal address
```

Without `LEGAL_ENTITY` and `LEGAL_CONTACT` the pages still render but show a
banner saying the operator has not configured them, and the header link is
hidden.

> **These are drafts, not legal advice.** They were written to describe this
> codebase accurately, which is the hard part, but the wording has not been
> reviewed by a lawyer. Have counsel review them before you rely on them, and
> update `LAST_UPDATED` in `lib/legal/operator.ts` when you change the text.

### Cookie consent

When `NEXT_PUBLIC_CLARITY_PROJECT_ID` is set, a consent banner appears and
**no analytics script loads until the visitor accepts**. Declining stores the
choice and loads nothing. Analytics is never loaded on `/s/...` share pages or
on the legal pages.

## Configuration

Everything is optional except the API key. Defaults are in parentheses.

### AI

| Variable | Description |
| --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Enables the AI analysis tab. Without it the tab returns an error and the rest of the app is unaffected. |
| `AI_MODEL` | Model used for analysis (`gemini-3.5-flash`). |
| `AI_FALLBACK_MODEL` | Tried when the primary model cannot start, for example on a provider 503 (`gemini-3.5-flash-lite`). |

### Rate limits

| Variable | Description |
| --- | --- |
| `AI_BURST_LIMIT` | AI requests per IP per minute (`3`). |
| `AI_DAILY_LIMIT` | AI requests per IP per day (`15`). |
| `AI_GLOBAL_DAILY_LIMIT` | AI requests across all clients per day (`400`). This is what protects your bill. |
| `PARSE_RATE_LIMIT` | Parse requests per IP per minute (`120`). |
| `SHARE_RATE_LIMIT` | Share links created per IP per hour (`20`). |
| `SHARE_OPEN_RATE_LIMIT` | Share link opens per IP per hour (`60`). |
| `RATE_LIMIT_SALT` | Salt for hashing client IPs. Random per process if unset; set it to keep counters stable across restarts. |
| `RATE_LIMIT_IP_HEADER` | Header to read the client IP from (`x-forwarded-for`, falling back to `x-real-ip`). |

Windows are fixed and aligned to UTC, so a daily limit really does reset at the
start of the day. IPs are never stored — only a salted SHA-256 digest, which is
all an equality check needs.

### Authentication

| Variable | Description |
| --- | --- |
| `AUTH_ENABLED` | `true` puts the whole app behind an email and password. Off by default. |
| `AUTH_SETUP_TOKEN` | If set, the first-run setup screen also requires this key. |
| `AUTH_SESSION_TTL_HOURS` | Session lifetime (`168`, seven days). |
| `AUTH_EMAIL` | Account email for stateless deployments, instead of the setup screen. |
| `AUTH_PASSWORD_HASH` | scrypt hash for that account. Generate with `pnpm auth:hash`. |
| `AUTH_RATE_LIMIT` | Sign-in and setup attempts per IP per 15 minutes (`10`). |

### Legal pages

| Variable | Description |
| --- | --- |
| `LEGAL_ENTITY` | Operator name shown as the data controller. Enables the legal pages' header link. |
| `LEGAL_CONTACT` | Contact address for data protection requests. |
| `LEGAL_ADDRESS` | Optional postal address. |
| `AI_PROVIDER_NAME` | How the AI provider is named in the legal text (`Google (Gemini API)`). |

### Frontend

These are inlined into the client bundle **at build time**, so a prebuilt Docker
image cannot be reconfigured with them at runtime — rebuild if you change them.

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_MONACO_CDN` | Where to load the Monaco editor from. Defaults to jsDelivr; point it at your own mirror for air-gapped or policy-restricted deployments. The CSP follows this value automatically. |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Enables Microsoft Clarity analytics behind a consent banner. **Disabled unless set.** Never loaded in development, on share pages or on legal pages. |

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm test` | Parser tests (60 tests, `node:test`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm auth:hash` | Print an `AUTH_PASSWORD_HASH` for a password |

## How it works

```
proxy.ts                    CSP header + per-request nonce
app/
  layout.tsx                Theme script, locale cookie, providers
  page.tsx                  Opens the workspace
  login/page.tsx            First-run setup or sign-in
  legal/...                 Privacy, KVKK and cookie pages
  s/[token]/page.tsx        One-time share link, confirmation screen
  api/parse/route.ts        Code -> ParsedSchema + static findings
  api/analyze/route.ts      ParsedSchema -> streaming AI analysis
  api/share/...             Create / check / open a one-time link
  api/auth/...              Setup, sign-in, sign-out
  api/health/route.ts       Liveness probe
components/
  workspace.tsx             Client orchestrator (ORM, tabs, layout)
  editor/schema-editor.tsx  Monaco, custom theme, Prisma tokenizer
  canvas/                   React Flow canvas and table node
  panels/                   Rule engine panel, AI panel, finding card
  share/                    Share dialog and reveal screen
lib/
  orm/                      One parser per ORM, all producing ParsedSchema
  flow/                     ParsedSchema -> nodes/edges + dagre layout
  analysis/                 Deterministic rule engine
  ai/                       Zod output schema, prompt, schema digest
  i18n/                     Dictionaries and locale helpers
  auth/                     scrypt hashing, account and session store
  legal/                    Configuration-driven legal document text
  security/                 Rate limit counters, IP key, body size guard
  share/store.ts            One-time record store
  storage/workspace.ts      Editor persistence in localStorage
  theme/read-palette.ts     Reads CSS variables for Monaco and React Flow
```

Every parser produces the same `ParsedSchema`. The diagram, the rule engine and
the AI layer only know about that type, which is why adding an ORM does not
touch anything else.

### Why the parser runs on the server

`ts-morph` pulls in the TypeScript compiler, roughly 6 MB. Shipping that to the
browser would badly hurt first load. The parsers in `lib/orm/*` are pure
functions, so running them client-side is just a matter of calling the same
functions inside a Web Worker — no UI changes needed.

### What the AI sees

The client sends raw source, and the server **parses it again** rather than
trusting the client's JSON. The model receives the parsed digest plus the rule
engine's findings marked as "already detected", so it spends its attention on
judgement calls instead of re-deriving structure. Output is constrained by a Zod
schema and streamed, so findings appear one field at a time.

If anything goes wrong on the model side — quota, invalid key, provider outage,
malformed output — the response is always the same 429 with the same message.
That is deliberate: the error text should not reveal whether a key is set, which
model is in use or which provider failed. The real error goes to the server log.

### One-time share links

**Share** produces a `/s/<token>` link that carries the schema and its ORM. The
link opens **once**: the content is deleted from the server the moment it is
read. Unopened links expire after 24 hours.

A `GET` deliberately does not consume the link — messaging apps and browsers
prefetch URLs, and the link would burn before the recipient ever saw it. The
page shows a confirmation screen and only a user-triggered `POST` reveals the
content. The one-time guarantee comes from `rename`, which is atomic on POSIX,
so out of two concurrent requests exactly one wins.

Shared content is stored unencrypted until it is read. Do not use it for
secrets.

### Where your work is stored

The editor content is written to `localStorage` under `ormlens:workspace:v1`
with a 500 ms debounce, so it survives closing the tab. **Reset** in the header
clears it and restores the samples. Nothing is written to a cookie — a cookie
travels to the server on every request and caps out around 4 KB, while schema
content can reach 256 KB.

## Adding a new ORM

1. Write a parser with the signature `(files, locale) => ParsedSchema` in
   `lib/orm/<orm>/index.ts`. For TypeScript-based ORMs, `createTsProject` and
   `ast-utils` do most of the work; for a custom DSL, the block reader in the
   Prisma parser is the pattern to copy.
2. Add the id to `ORM_IDS` in `lib/orm/types.ts`.
3. Add a sample schema in `lib/orm/samples.ts` and the label plus file tabs in
   `lib/orm/catalog.ts`.
4. Register the parser in the map in `lib/orm/parse.ts`.

Add tests in `lib/orm/<orm>/<orm>.test.ts`. The existing suites are the
specification for what each parser is expected to handle.

## Supported syntax

Scope is pinned by the tests in `lib/orm/*/*.test.ts`.

**Drizzle** — `pgTable`/`mysqlTable`/`sqliteTable` with automatic dialect
detection, named and unnamed columns, chained builders (`primaryKey`, `notNull`,
`unique`, `default*`, `array`, `references`), both array and object forms of the
third table argument (`index`, `uniqueIndex`, `primaryKey({columns})`,
`foreignKey({...})`), `pgEnum` and inline `{ enum: [...] }`, `relations()`
blocks.

**Prisma** — dialect from the `datasource` provider, `model`/`enum`/`view`
blocks, `@id`/`@unique`/`@default`/`@map`/`@db.*`/`@relation`,
`@@map`/`@@id`/`@@index`/`@@unique`, optional (`?`) and list (`[]`) fields. A
relation field is distinguished from its foreign key column; only the column
appears in the diagram.

**TypeORM** — `@Entity` classes, `@PrimaryGeneratedColumn`/`@PrimaryColumn`/
`@Column` options, the `@CreateDateColumn` family, type inference from the
TypeScript type, class-level and field-level `@Index`/`@Unique`,
`@ManyToOne`/`@OneToMany`/`@OneToOne`/`@ManyToMany`, `@JoinColumn({ name })`.

**MikroORM** — `@Entity({ tableName })`, `@PrimaryKey`/`@Property`/`@Enum`
options, `@Index`/`@Unique({ properties })`, relation decorators. Note that a
`@ManyToOne` property **is itself** the foreign key column.

**Sequelize** — `sequelize.define(...)` and `class X extends Model` +
`X.init(...)`, shorthand (`DataTypes.STRING`) and long attribute forms,
`field`/`allowNull`/`unique`/`primaryKey`/`autoIncrement`/`defaultValue`/
`references`, `tableName`, `indexes`, default `timestamps` and the implicit
`id`, plus `belongsTo`/`hasMany`/`hasOne`/`belongsToMany` calls, which add the
foreign key column when the model does not declare it.

**Kysely** — table interfaces, table names from the `Database` map,
`Generated<>` and `ColumnType<>` unwrapping, nullability via `| null` and `?`,
array types. Kysely's type layer carries no relations, so foreign keys are only
inferred when a column name matches a table name (`user_id` → `users`). Those
edges are drawn dashed, and constraint checks such as "missing onDelete" are not
applied to them.

**Mongoose** — `new Schema({...}, {...})`, the `mongoose.model('Name', schema)`
mapping, shorthand (`String`) and long (`{ type: String, required: true }`)
field forms, relations via `ref`, `enum`, `unique`, `index: true`,
`schema.index()`, `timestamps`, embedded subdocuments, the implicit `_id`.

## Interface details

**Languages.** Turkish and English, switchable in the header. Server-produced
text — parser diagnostics, rule engine findings, AI output — is localised too,
because the locale travels with the request.

**Theme.** Dark and light. The theme is an attribute on `<html>` set by an
inline script before first paint, so there is no flash. The locale is a cookie
rather than `localStorage` so the server can render the correct language
without a hydration mismatch.

**Colors.** The whole palette lives in CSS variables in `app/globals.css`.
Monaco and React Flow do not accept CSS classes, so `lib/theme/read-palette.ts`
reads the computed values back out.

## Security

Rate limits, the error masking policy, the threat model and the known
limitations of a single-process deployment are documented in
[SECURITY.md](SECURITY.md). Please report vulnerabilities privately through
GitHub Security Advisories rather than in a public issue.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome,
particularly new ORM parsers and additional rules for the rule engine.

## License

[MIT](LICENSE) © Tolga Zorlu
