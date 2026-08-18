import type { Finding } from "@/lib/analysis/types";
import type { ParsedSchema, ParsedTable } from "@/lib/orm/types";

const DIALECT_LABEL: Record<string, string> = {
  pg: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  sqlserver: "SQL Server",
  mongo: "MongoDB",
  unknown: "unknown",
};

const ORM_LABEL: Record<string, string> = {
  drizzle: "Drizzle ORM",
  prisma: "Prisma",
  mongoose: "Mongoose",
};

export function toSchemaDigest(schema: ParsedSchema): string {
  const entity = schema.dialect === "mongo" ? "COLLECTION" : "TABLE";
  const lines: string[] = [
    `ORM: ${ORM_LABEL[schema.orm] ?? schema.orm}`,
    `DATABASE: ${DIALECT_LABEL[schema.dialect] ?? schema.dialect}`,
    "",
  ];

  if (schema.enums.length > 0) {
    lines.push("ENUMS");
    for (const item of schema.enums) {
      lines.push(`  ${item.name} = [${item.values.join(", ")}]`);
    }
    lines.push("");
  }

  for (const table of schema.tables) {
    lines.push(`${entity} ${table.name}  (code identifier: ${table.id})`);
    for (const column of table.columns) {
      lines.push(`  ${describeColumn(column)}`);
    }
    if (table.compositePrimaryKey.length > 0) {
      lines.push(`  COMPOSITE PK (${table.compositePrimaryKey.join(", ")})`);
    }
    for (const index of table.indexes) {
      const label = index.isUnique ? "UNIQUE INDEX" : "INDEX";
      lines.push(`  ${label} ${index.name ?? ""}(${index.columns.join(", ")})`.replace(/\s+\(/, " ("));
    }
    lines.push("");
  }

  if (schema.relations.length > 0) {
    lines.push("DECLARED RELATIONS");
    for (const relation of schema.relations) {
      const mapping =
        relation.fields.length > 0
          ? ` fields=[${relation.fields.join(", ")}] references=[${relation.references.join(", ")}]`
          : " (no column mapping)";
      lines.push(
        `  ${relation.sourceTable}.${relation.fieldName}: ${relation.kind}(${relation.targetTable})${mapping}`,
      );
    }
    lines.push("");
  } else {
    lines.push("DECLARED RELATIONS: none", "");
  }

  return lines.join("\n").trim();
}

function describeColumn(column: ParsedTable["columns"][number]): string {
  const flags: string[] = [];
  if (column.isPrimaryKey) flags.push("PK");
  if (column.isNotNull) flags.push("NOT NULL");
  if (column.isUnique) flags.push("UNIQUE");
  if (column.hasDefault) flags.push(`DEFAULT ${column.defaultValue ?? ""}`.trim());
  if (column.enumValues?.length) flags.push(`values=[${column.enumValues.join(", ")}]`);
  if (column.reference) {
    flags.push(
      `REFERENCES ${column.reference.table}.${column.reference.column}` +
        (column.reference.onDelete ? ` ON DELETE ${column.reference.onDelete}` : " (no onDelete)"),
    );
  }

  const alias = column.key === column.name ? "" : ` [code: ${column.key}]`;
  return `${column.name} ${column.displayType}${alias}${flags.length ? `  ${flags.join(", ")}` : ""}`;
}

export function toStaticFindingsDigest(findings: Finding[]): string {
  if (findings.length === 0) return "The rule engine produced no findings.";

  return findings
    .map(
      (finding) =>
        `- [${finding.severity}/${finding.category}] ${finding.title}` +
        (finding.table ? ` (table: ${finding.table})` : ""),
    )
    .join("\n");
}
