import type { Locale } from "@/lib/i18n/locales";
import type { OrmId, ParsedColumn, ParsedSchema, ParsedTable } from "@/lib/orm/types";
import { CHECK_MESSAGES } from "./messages";
import { sortFindings, type Finding } from "./types";

/**
 * Deterministik kural motoru.
 *
 * İki işi var:
 *  1. AI anahtarı olmadan da anında değer üretmek (panel boş kalmasın).
 *  2. AI prompt'una "kanıtlanmış tespitler" olarak girip modelin aynı şeyleri
 *     tahmin etmeye çalışmasını engellemek — model böylece yorum gerektiren
 *     konulara odaklanır.
 *
 * Kontroller ORM ve lehçeye göre filtreleniyor: Mongoose'ta veritabanı
 * seviyesinde `onDelete` yoktur, Prisma'da `@relation` zaten FK üretir,
 * `relations()` kapsamı ise yalnızca Drizzle'ın derdidir.
 */
export function runStaticChecks(schema: ParsedSchema, locale: Locale = "tr"): Finding[] {
  const t = CHECK_MESSAGES[locale] ?? CHECK_MESSAGES.tr;
  const findings: Finding[] = [];
  const tables = new Map(schema.tables.map((table) => [table.id, table]));
  // Yalnızca belge veritabanlarında FK/onDelete kavramı yoktur. TypeORM,
  // Sequelize gibi lehçesini bildirmeyen ORM'ler ilişkisel sayılır.
  const isRelational = schema.dialect !== "mongo" && schema.orm !== "mongoose";

  for (const table of schema.tables) {
    const hasPrimaryKey =
      table.columns.some((column) => column.isPrimaryKey) || table.compositePrimaryKey.length > 0;

    if (!hasPrimaryKey) {
      findings.push({
        id: `pk:${table.id}`,
        severity: "critical",
        category: "data-integrity",
        title: t.missingPrimaryKey.title(table.name),
        table: table.id,
        description: t.missingPrimaryKey.description,
        suggestion: t.missingPrimaryKey.suggestion,
        codeFix: primaryKeyFix(schema.orm),
      });
    }

    for (const column of table.columns) {
      findings.push(...checkColumn(schema, table, column, tables, t, isRelational));
    }
  }

  if (schema.orm === "drizzle") {
    findings.push(...checkDrizzleRelationCoverage(schema, t));
  }

  return sortFindings(findings);
}

function checkColumn(
  schema: ParsedSchema,
  table: ParsedTable,
  column: ParsedColumn,
  tables: Map<string, ParsedTable>,
  t: (typeof CHECK_MESSAGES)[Locale],
  isRelational: boolean,
): Finding[] {
  const findings: Finding[] = [];
  const reference = column.reference;

  if (reference && tables.has(reference.table)) {
    if (!isIndexed(table, column.key)) {
      findings.push({
        id: `fk-index:${table.id}.${column.key}`,
        severity: "high",
        category: "index",
        title: t.fkNoIndex.title(table.name, column.name),
        table: table.id,
        columns: [column.key],
        description: t.fkNoIndex.description(reference.table),
        suggestion: t.fkNoIndex.suggestion(column.name),
        codeFix: indexFix(schema.orm, table, column),
      });
    }

    /**
     * Mongoose'ta veritabanı seviyesinde silme davranışı yoktur. Çıkarılmış
     * referanslarda da bu kontrolü atlıyoruz: kısıtın var olduğunu bilmiyoruz
     * (Kysely'de FK'ler migration'larda tanımlıdır), "onDelete eksik" demek
     * yanlış bilgi olurdu.
     */
    if (isRelational && !reference.isInferred && !reference.onDelete) {
      findings.push({
        id: `fk-ondelete:${table.id}.${column.key}`,
        severity: "medium",
        category: "data-integrity",
        title: t.fkNoOnDelete.title(table.name, column.name),
        table: table.id,
        columns: [column.key],
        description: t.fkNoOnDelete.description,
        suggestion: t.fkNoOnDelete.suggestion,
        codeFix: onDeleteFix(schema.orm, reference.table, reference.column),
      });
    }
  }

  const name = column.name.toLowerCase();

  if (
    ["email", "username", "slug", "handle"].some(
      (token) => name === token || name.endsWith(`_${token}`),
    ) &&
    !column.isUnique &&
    !column.isPrimaryKey &&
    !isUniquelyIndexed(table, column.key)
  ) {
    findings.push({
      id: `unique:${table.id}.${column.key}`,
      severity: "medium",
      category: "data-integrity",
      title: t.uniqueLikely.title(table.name, column.name),
      table: table.id,
      columns: [column.key],
      description: t.uniqueLikely.description,
      suggestion: t.uniqueLikely.suggestion,
      codeFix: uniqueFix(schema.orm, column),
    });
  }

  if (["password", "secret", "token", "api_key", "apikey"].some((token) => name.includes(token))) {
    findings.push({
      id: `secret:${table.id}.${column.key}`,
      severity: "high",
      category: "security",
      title: t.secretColumn.title(table.name, column.name),
      table: table.id,
      columns: [column.key],
      description: t.secretColumn.description,
      suggestion: t.secretColumn.suggestion,
    });
  }

  if (schema.dialect === "pg" && column.isPrimaryKey && column.type.toLowerCase() === "text") {
    findings.push({
      id: `text-pk:${table.id}.${column.key}`,
      severity: "low",
      category: "performance",
      title: t.textPrimaryKey.title(table.name),
      table: table.id,
      columns: [column.key],
      description: t.textPrimaryKey.description,
      suggestion: t.textPrimaryKey.suggestion,
    });
  }

  return findings;
}

/** Drizzle'a özgü: FK var ama `relations()` yok (ya da tersi). */
function checkDrizzleRelationCoverage(
  schema: ParsedSchema,
  t: (typeof CHECK_MESSAGES)[Locale],
): Finding[] {
  const findings: Finding[] = [];

  if (schema.relations.length === 0 && schema.tables.length > 0) {
    const hasForeignKeys = schema.tables.some((table) =>
      table.columns.some((column) => column.reference),
    );
    if (hasForeignKeys) {
      findings.push({
        id: "relations:missing-file",
        severity: "medium",
        category: "relation",
        title: t.relationsMissing.title,
        description: t.relationsMissing.description,
        suggestion: t.relationsMissing.suggestion,
      });
      return findings;
    }
  }

  const declared = new Set(
    schema.relations
      .filter((relation) => relation.kind === "one" && relation.fields.length > 0)
      .map((relation) => `${relation.sourceTable}.${relation.fields[0]}`),
  );

  for (const table of schema.tables) {
    for (const column of table.columns) {
      if (!column.reference) continue;
      if (declared.has(`${table.id}.${column.key}`)) continue;

      findings.push({
        id: `relation-missing:${table.id}.${column.key}`,
        severity: "low",
        category: "relation",
        title: t.relationNotDeclared.title(table.name, column.name),
        table: table.id,
        columns: [column.key],
        description: t.relationNotDeclared.description,
        suggestion: t.relationNotDeclared.suggestion(table.id),
        codeFix: `${column.key.replace(/Id$/, "")}: one(${column.reference.table}, {
  fields: [${table.id}.${column.key}],
  references: [${column.reference.table}.${column.reference.column}],
}),`,
      });
    }
  }

  for (const relation of schema.relations) {
    if (relation.kind !== "one" || relation.fields.length === 0) continue;
    const table = schema.tables.find((item) => item.id === relation.sourceTable);
    const column = table?.columns.find((item) => item.key === relation.fields[0]);
    if (!table || !column || column.reference) continue;

    findings.push({
      id: `relation-no-fk:${relation.id}`,
      severity: "medium",
      category: "data-integrity",
      title: t.relationWithoutFk.title(relation.id),
      table: relation.sourceTable,
      columns: [relation.fields[0]],
      description: t.relationWithoutFk.description,
      suggestion: t.relationWithoutFk.suggestion,
      codeFix: `.references(() => ${relation.targetTable}.${relation.references[0] ?? "id"}, { onDelete: 'cascade' })`,
    });
  }

  return findings;
}

/* Kod parçaları dile değil ORM'e bağlı. */

function primaryKeyFix(orm: OrmId): string {
  if (orm === "prisma") return "id Int @id @default(autoincrement())";
  if (orm === "mongoose") return "// Mongoose _id alanını kendisi ekler";
  return "id: serial('id').primaryKey(),";
}

function indexFix(orm: OrmId, table: ParsedTable, column: ParsedColumn): string {
  if (orm === "prisma") return `@@index([${column.key}])`;
  if (orm === "mongoose") return `${table.id.toLowerCase()}Schema.index({ ${column.key}: 1 });`;
  return `(t) => [index('${table.name}_${column.name}_idx').on(t.${column.key})]`;
}

function onDeleteFix(orm: OrmId, targetTable: string, targetColumn: string): string {
  if (orm === "prisma") {
    return `@relation(fields: [...], references: [${targetColumn}], onDelete: Cascade)`;
  }
  return `.references(() => ${targetTable}.${targetColumn}, { onDelete: 'cascade' })`;
}

function uniqueFix(orm: OrmId, column: ParsedColumn): string {
  if (orm === "prisma") return `${column.key} String @unique`;
  if (orm === "mongoose") return `${column.key}: { type: String, required: true, unique: true },`;
  return `${column.key}: ${column.type}('${column.name}').notNull().unique(),`;
}

function isIndexed(table: ParsedTable, columnKey: string): boolean {
  if (table.compositePrimaryKey[0] === columnKey) return true;
  const column = table.columns.find((item) => item.key === columnKey);
  if (column?.isPrimaryKey || column?.isUnique) return true;
  // Bileşik index'te ilk kolon olmak da tarama için yeterlidir.
  return table.indexes.some((index) => index.columns[0] === columnKey);
}

function isUniquelyIndexed(table: ParsedTable, columnKey: string): boolean {
  return table.indexes.some(
    (index) => index.isUnique && index.columns.length === 1 && index.columns[0] === columnKey,
  );
}
