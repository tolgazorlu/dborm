/**
 * Parser çıktısının veri sözleşmesi — tüm ORM'ler için ortak.
 *
 * Drizzle, Prisma ve Mongoose parser'ları farklı kaynak dillerini okur ama
 * hepsi bu yapıyı üretir. Diyagram, kural motoru ve AI katmanları yalnızca
 * bunu bilir; yeni bir ORM eklemek için sadece yeni bir parser yazmak yeter.
 */

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

/** Belge veritabanlarında "tablo" yerine koleksiyon deniyor; etiketleme için. */
export function isDocumentDialect(dialect: Dialect): boolean {
  return dialect === "mongo";
}

export interface ColumnReference {
  /** Hedef tablonun kimliği (Drizzle'da değişken adı, Prisma'da model adı) */
  table: string;
  /** Hedef kolonun anahtarı */
  column: string;
  onDelete?: string;
  onUpdate?: string;
  /** Bileşik/açık FK tanımından mı geldi (Drizzle `foreignKey()`, Prisma `@relation`) */
  isComposite: boolean;
  /**
   * Şemada açık bir bildirim yok; adlandırma kuralından çıkarıldı.
   * (Kysely gibi ilişki bilgisi taşımayan katmanlarda tek sinyal budur.)
   * Diyagramda kesik çizgiyle gösterilir.
   */
  isInferred?: boolean;
}

export interface ParsedColumn {
  /** Kodda kullanılan alan adı, ör. `authorId` */
  key: string;
  /** Veritabanındaki kolon adı, ör. `author_id`. Verilmemişse `key`. */
  name: string;
  /** Ham tip adı, ör. `varchar`, `String`, `ObjectId` */
  type: string;
  /** Parametreleriyle okunabilir tip, ör. `varchar(255)`, `String[]` */
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
  /** Diyagram node id'si: Drizzle değişken adı, Prisma/Mongoose model adı */
  id: string;
  /** Veritabanındaki tablo/koleksiyon adı */
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
  /** İlişkinin kod tarafındaki alan adı, ör. `author` */
  fieldName: string;
  targetTable: string;
  /** Kaynak tablodaki kolon anahtarları */
  fields: string[];
  /** Hedef tablodaki kolon anahtarları */
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
  /** ör. `schema.ts`, `schema.prisma` — teşhis mesajlarında kullanılır */
  path: string;
  content: string;
}

export function emptySchema(orm: OrmId): ParsedSchema {
  return { orm, dialect: "unknown", tables: [], enums: [], relations: [], diagnostics: [] };
}
