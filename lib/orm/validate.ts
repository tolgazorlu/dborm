import type { Locale } from "@/lib/i18n/locales";
import type { ParsedSchema, ParsedTable } from "./types";

interface ValidationMessages {
  duplicateTable: (name: string, first: string, second: string) => string;
  duplicateTableId: (id: string, first: string, second: string) => string;
  missingPrimaryKey: (table: string) => string;
  unknownReferenceTable: (source: string, target: string) => string;
  unknownReferenceColumn: (source: string, target: string) => string;
  relationSourceMissing: (relation: string, table: string) => string;
  relationTargetMissing: (relation: string, table: string) => string;
}

const MESSAGES: Record<Locale, ValidationMessages> = {
  tr: {
    duplicateTable: (name, first, second) =>
      `\`${name}\` tablo adı birden fazla kez tanımlanmış (${first} ve ${second}).`,
    duplicateTableId: (id, first, second) =>
      `\`${id}\` iki dosyada birden tanımlanmış (${first} ve ${second}); diyagramda ilki gösteriliyor.`,
    missingPrimaryKey: (table) => `\`${table}\` tablosunda birincil anahtar tanımlı değil.`,
    unknownReferenceTable: (source, target) =>
      `\`${source}\` bilinmeyen bir tabloya referans veriyor: \`${target}\`.`,
    unknownReferenceColumn: (source, target) => `\`${source}\` → \`${target}\` kolonu bulunamadı.`,
    relationSourceMissing: (relation, table) =>
      `\`${relation}\` ilişkisinin kaynak tablosu bulunamadı: \`${table}\`.`,
    relationTargetMissing: (relation, table) =>
      `\`${relation}\` ilişkisinin hedef tablosu bulunamadı: \`${table}\`.`,
  },
  en: {
    duplicateTable: (name, first, second) =>
      `Table name \`${name}\` is defined more than once (${first} and ${second}).`,
    duplicateTableId: (id, first, second) =>
      `\`${id}\` is declared in two files (${first} and ${second}); the diagram shows the first one.`,
    missingPrimaryKey: (table) => `Table \`${table}\` has no primary key.`,
    unknownReferenceTable: (source, target) =>
      `\`${source}\` references an unknown table: \`${target}\`.`,
    unknownReferenceColumn: (source, target) => `\`${source}\` → column \`${target}\` not found.`,
    relationSourceMissing: (relation, table) =>
      `Source table of relation \`${relation}\` not found: \`${table}\`.`,
    relationTargetMissing: (relation, table) =>
      `Target table of relation \`${relation}\` not found: \`${table}\`.`,
  },
};

export function validateSchema(schema: ParsedSchema, locale: Locale): void {
  const t = MESSAGES[locale] ?? MESSAGES.tr;
  // First declaration wins, matching what the canvas draws.
  const tablesById = new Map<string, ParsedTable>();
  for (const table of schema.tables) {
    if (!tablesById.has(table.id)) tablesById.set(table.id, table);
  }
  const seenNames = new Map<string, string>();
  const seenIds = new Map<string, string>();

  for (const table of schema.tables) {
    // Two files exporting the same identifier make references ambiguous and
    // collapse into a single node on the canvas.
    const duplicateId = seenIds.get(table.id);
    if (duplicateId) {
      schema.diagnostics.push({
        level: "warning",
        message: t.duplicateTableId(table.id, duplicateId, table.file),
        file: table.file,
        line: table.line,
      });
    } else {
      seenIds.set(table.id, table.file);
    }

    const duplicate = seenNames.get(table.name);
    if (duplicate) {
      schema.diagnostics.push({
        level: "warning",
        message: t.duplicateTable(table.name, duplicate, table.id),
        file: table.file,
        line: table.line,
      });
    } else {
      seenNames.set(table.name, table.id);
    }

    const hasPrimaryKey =
      table.columns.some((column) => column.isPrimaryKey) || table.compositePrimaryKey.length > 0;
    if (!hasPrimaryKey) {
      schema.diagnostics.push({
        level: "warning",
        message: t.missingPrimaryKey(table.name),
        file: table.file,
        line: table.line,
      });
    }

    for (const column of table.columns) {
      const reference = column.reference;
      if (!reference) continue;

      const target = tablesById.get(reference.table);
      if (!target) {
        schema.diagnostics.push({
          level: "warning",
          message: t.unknownReferenceTable(`${table.id}.${column.key}`, reference.table),
          file: table.file,
          line: table.line,
        });
        continue;
      }
      if (!target.columns.some((item) => item.key === reference.column)) {
        schema.diagnostics.push({
          level: "warning",
          message: t.unknownReferenceColumn(
            `${table.id}.${column.key}`,
            `${reference.table}.${reference.column}`,
          ),
          file: table.file,
          line: table.line,
        });
      }
    }
  }

  for (const relation of schema.relations) {
    if (!tablesById.has(relation.sourceTable)) {
      schema.diagnostics.push({
        level: "warning",
        message: t.relationSourceMissing(relation.id, relation.sourceTable),
        file: relation.file,
        line: relation.line,
      });
    }
    if (!tablesById.has(relation.targetTable)) {
      schema.diagnostics.push({
        level: "warning",
        message: t.relationTargetMissing(relation.id, relation.targetTable),
        file: relation.file,
        line: relation.line,
      });
    }
  }
}

export function parseFailureMessage(locale: Locale, detail: string): string {
  return locale === "en" ? `Could not parse schema: ${detail}` : `Şema ayrıştırılamadı: ${detail}`;
}
