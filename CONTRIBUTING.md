# Contributing

Thanks for taking a look. Issues and pull requests are both welcome.

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

An API key is optional. Everything except the AI analysis panel works without
one.

## Before opening a pull request

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

All four must pass. Parser behaviour is pinned by tests in
`lib/orm/*/*.test.ts`; a change to a parser needs a test that fails without it.

## Adding an ORM

See [Adding a new ORM](README.md#adding-a-new-orm). In short: write a
`(files, locale) => ParsedSchema` function, register the id, add a sample and
wire it into the dispatcher. The diagram, rule engine and AI layer only know
about `ParsedSchema`, so nothing else changes.

## Style

- The codebase has no comments. Prefer names and structure that do not need one.
- All code, identifiers, commit messages and documentation are in English.
- User-facing strings belong in `lib/i18n/dictionary.ts` and must be added to
  both the `tr` and `en` dictionaries; TypeScript enforces that the shapes match.
