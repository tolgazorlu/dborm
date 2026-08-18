
export const ORM_IDS = [
  "drizzle",
  "prisma",
  "typeorm",
  "mikroorm",
  "sequelize",
  "kysely",
  "mongoose",
] as const;
export type OrmId = (typeof ORM_IDS)[number];

export type Dialect = "pg" | "mysql" | "sqlite" | "sqlserver" | "mongo" | "unknown";

export function isDocumentDialect(dialect: Dialect): boolean {
  return dialect === "mongo";
}

export interface ColumnReference {
  table: string;
  column: string;
  onDelete?: string;
  onUpdate?: string;
  isComposite: boolean;
  isInferred?: boolean;
}

export interface ParsedColumn {
  key: string;
  name: string;
  type: string;
  displayType: string;
  isPrimaryKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  hasDefault: boolean;
  defaultValue?: string;
  isArray: boolean;
  enumName?: string;
  enumValues?: string[];
  reference?: ColumnReference;
}

export interface ParsedIndex {
  name?: string;
  columns: string[];
  isUnique: boolean;
}

export interface ParsedTable {
  id: string;
  name: string;
  dialect: Dialect;
  columns: ParsedColumn[];
  indexes: ParsedIndex[];
  compositePrimaryKey: string[];
  line: number;
  file: string;
}

export interface ParsedEnum {
  id: string;
  name: string;
  values: string[];
}

export type RelationKind = "one" | "many";

export interface ParsedRelation {
  id: string;
  kind: RelationKind;
  sourceTable: string;
  fieldName: string;
  targetTable: string;
  fields: string[];
  references: string[];
  relationName?: string;
  line: number;
  file: string;
}

export type DiagnosticLevel = "error" | "warning" | "info";

export interface ParseDiagnostic {
  level: DiagnosticLevel;
  message: string;
  file?: string;
  line?: number;
}

export interface ParsedSchema {
  orm: OrmId;
  dialect: Dialect;
  tables: ParsedTable[];
  enums: ParsedEnum[];
  relations: ParsedRelation[];
  diagnostics: ParseDiagnostic[];
}

export interface ParserFile {
  path: string;
  content: string;
}

export function emptySchema(orm: OrmId): ParsedSchema {
  return { orm, dialect: "unknown", tables: [], enums: [], relations: [], diagnostics: [] };
}
