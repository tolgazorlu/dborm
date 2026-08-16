import type { Finding } from "@/lib/analysis/types";
import type { Locale } from "@/lib/i18n/locales";
import type { OrmId, ParsedSchema } from "@/lib/orm/types";
import { toSchemaDigest, toStaticFindingsDigest } from "./schema-digest";

const OUTPUT_LANGUAGE: Record<Locale, string> = {
  tr: "Turkish",
  en: "English",
};

/** ORM'e göre değişen, koda dokunan beklentiler. */
const ORM_NOTES: Record<OrmId, string> = {
  drizzle:
    "The project uses Drizzle ORM. Code fixes must be valid Drizzle syntax (column builders, " +
    "the third table argument for indexes, `relations()` declarations).",
  prisma:
    "The project uses Prisma. Code fixes must be valid Prisma schema syntax (`@` field attributes, " +
    "`@@index` / `@@unique` block attributes, `@relation`).",
  typeorm:
    "The project uses TypeORM. Code fixes must be valid TypeORM decorator syntax " +
    "(`@Column`, `@Index`, `@ManyToOne` options such as `onDelete`).",
  mikroorm:
    "The project uses MikroORM. Note that a `@ManyToOne` property is itself the foreign key " +
    "column. Code fixes must be valid MikroORM decorator syntax (`@Property`, `@Index`, " +
    "`@ManyToOne({ deleteRule })`).",
  sequelize:
    "The project uses Sequelize. Relations are declared with `belongsTo`/`hasMany` calls rather " +
    "than in the model definition. Code fixes must be valid Sequelize syntax (attribute options, " +
    "the `indexes` model option, association options).",
  kysely:
    "The project uses Kysely, which is a typed query builder: the schema lives in TypeScript " +
    "interfaces and carries no relation or constraint information. Foreign keys, indexes and " +
    "defaults exist only in migrations, so point those out as things to verify rather than " +
    "assuming they are missing. Code fixes should be Kysely interface changes or migration " +
    "snippets (`db.schema.createIndex(...)`).",
  mongoose:
    "The project uses Mongoose on MongoDB. There are no database-level foreign keys: referential " +
    "integrity is the application's responsibility. Consider embedding versus referencing, " +
    "compound indexes, and unbounded array growth. Code fixes must be valid Mongoose syntax.",
};

export function buildSystemPrompt(locale: Locale, orm: OrmId): string {
  return `You are a senior database architect reviewing an application schema.

Your job: evaluate the schema with production eyes and produce concrete findings.

${ORM_NOTES[orm]}

Rules:
- Write ALL output in ${OUTPUT_LANGUAGE[locale]}.
- Produce at most 12 findings, most critical first.
- Do NOT repeat anything from the "already detected" list. Those come from deterministic rules
  and are shown to the user separately. Focus on what needs judgement, domain knowledge or a
  guess about query patterns.
- Each finding covers exactly one issue. No generic advice ("use indexes") — say which
  table/field and what to do.
- codeFix must contain only an applicable snippet, never the whole file.
- If the schema is genuinely fine, returning few findings is correct; do not invent problems.
  Set healthScore honestly, weighted by the severity of what you found.

Look especially for:
- Missing indexes implied by likely query patterns (date ranges, status filters, multi-column
  filter + sort combinations, partial index opportunities).
- Badly modelled relations: missing join table, hidden many-to-many, wrong direction, delete
  behaviour that would create orphans, self-referencing cycles.
- Data modelling mistakes: normalisation issues, duplicated fields, enum where a lookup table
  belongs, wrong type for money/decimals, timestamps without time zone.
- Scale: surrogate key choice, tenant column placement in multi-tenant designs, archiving and
  partitioning for tables that will grow.
- Security and privacy: personally identifiable data, secret storage, missing soft-delete and
  audit fields.`;
}

export function buildAnalysisPrompt(schema: ParsedSchema, staticFindings: Finding[]): string {
  return [
    "## Parsed schema",
    "",
    toSchemaDigest(schema),
    "",
    "## Already detected (do not repeat)",
    "",
    toStaticFindingsDigest(staticFindings),
    "",
    "## Task",
    "",
    "Review the schema above and produce an analysis matching the required JSON shape.",
  ].join("\n");
}
