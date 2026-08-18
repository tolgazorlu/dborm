# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately
through [GitHub Security Advisories](https://github.com/tolgazorlu/ormlens/security/advisories/new).
Include what you found, how to reproduce it and the impact you expect. You will
get an initial response within a few days.

## Threat model

ORMLens accepts untrusted schema source code, parses it on the server and
optionally sends a parsed digest to an AI provider. It ships open to everyone;
`AUTH_ENABLED=true` puts the whole app behind a single email and password
account. There is no user database, no sign-up and no password reset.

What the code assumes and defends against:

- **Untrusted input.** Schema code is parsed with `ts-morph` inside a request
  handler. Input is capped at 256 KB per request and the request body itself is
  capped at 512 KB, counted while the stream is read rather than after it is
  buffered.
- **Cost and CPU abuse.** Every endpoint is rate limited per client IP, and the
  AI endpoint additionally has a global daily cap so no combination of clients
  can run up the model bill. See [Rate limits](README.md#rate-limits).
- **Information disclosure.** Failures on the AI path always return the same
  429 and the same message, so the response never reveals whether a key is
  configured, which model is used or which provider failed.
- **XSS.** A per-request nonce CSP with `'strict-dynamic'` is set in `proxy.ts`.
  No user or model content is rendered as HTML.
- **Clickjacking.** `frame-ancestors 'none'` plus `X-Frame-Options: DENY`.
- **Path traversal.** Share tokens are validated against a strict pattern before
  they ever reach a file path.
- **Credential attacks** (when authentication is on). Passwords are hashed with
  scrypt (N=2^15, r=8, p=1) and compared in constant time. A sign-in attempt
  against a non-existent account still performs a full hash verification so
  timing does not disclose whether the account exists. Attempts are rate limited
  per IP.
- **Session theft.** Session tokens are 32 random bytes; only their SHA-256
  digest is stored, so the stored record cannot be replayed. The cookie is
  HttpOnly, SameSite=Lax, and Secure with the `__Host-` prefix over HTTPS.
  Signing out deletes the record server-side.
- **CSRF.** Every authentication endpoint verifies that `Origin` matches the
  request host, in addition to the SameSite cookie attribute.

## Known limitations

Read these before deploying publicly.

- **Rate limit state is per process.** Counters live in memory. On a
  multi-instance or serverless deployment each instance keeps its own counters,
  so the effective limit is `instances × limit`. Replace
  `lib/security/rate-limit.ts` with a shared store (Redis, Upstash) for real
  multi-instance deployments.
- **Client IP comes from a header.** `x-forwarded-for` is trusted. Behind a
  reverse proxy or CDN that is correct, but if the app is exposed directly to
  the internet a client can spoof the header and bypass the limits. Always run
  it behind a proxy, and set `RATE_LIMIT_IP_HEADER` when your proxy uses a
  different header (for example `cf-connecting-ip`).
- **Share storage is the local file system.** `lib/share/store.ts` writes to
  `.data/shares`. On serverless each instance sees its own disk, so links
  created on one instance are not readable on another. Replace the module with
  Redis or a KV store in that case.
- **Shared schemas are stored unencrypted** for up to 24 hours, or until the
  link is opened. Do not use the share feature for secrets.
- **Prompt injection is possible by design.** Schema content is part of the
  model prompt, so a crafted schema can influence what the model writes back.
  Model output is only ever rendered as text, never as HTML or executed code, so
  the blast radius is misleading analysis text rather than code execution.
- **First-run setup is a claim race.** With `AUTH_ENABLED=true` and no account
  yet, whoever reaches the app first creates the owner account. Complete setup
  immediately after deploying, or set `AUTH_SETUP_TOKEN` so only someone holding
  that key can complete it.
- **There is exactly one account** and no password reset. Losing the password
  means deleting `.data/auth/account.json` (or clearing `AUTH_EMAIL` and
  `AUTH_PASSWORD_HASH`) and running setup again.
- **Sessions are stored on the local file system**, so the multi-instance
  caveat above applies to sign-ins as well.
- **The legal pages are drafts, not legal advice.** They describe this
  codebase's actual behaviour accurately but have not been reviewed by a lawyer.
- **The Monaco editor loads from a public CDN** (jsDelivr) without subresource
  integrity, because the loader injects the script itself. Point
  `NEXT_PUBLIC_MONACO_CDN` at a mirror you control if that is not acceptable in
  your environment.

## Supported versions

Only the latest commit on `main` receives fixes.
