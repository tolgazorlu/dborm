import { Node, type Expression, type SourceFile } from "ts-morph";

import type { Locale } from "@/lib/i18n/locales";
import { literalValue, propertyName, stringArrayElements } from "../ast-utils";
import { createTsProject, syntacticDiagnostics } from "../ts-project";
import {
  emptySchema,
  type ParseDiagnostic,
  type ParsedColumn,
  type ParsedRelation,
  type ParsedSchema,
  type ParsedTable,
  type ParserFile,
} from "../types";
import { parseFailureMessage, validateSchema } from "../validate";

/**
 * Mongoose şemaları düz TypeScript olduğu için Drizzle ile aynı ts-morph
 * altyapısını kullanır; okuduğu kalıplar farklıdır:
 *
 *   const userSchema = new Schema({ email: { type: String, unique: true } });
 *   export const User = mongoose.model('User', userSchema);
 *
 * İlişkiler `ref: 'User'` ile kurulur — yani hedef, değişken değil **model
 * adıdır**. Bu yüzden önce şema değişkeni → model adı eşlemesi çıkarılır,
 * tablo kimliği olarak model adı kullanılır.
 */

/** Mongoose her belgeye otomatik olarak bu alanı ekler. */
const IMPLICIT_ID: ParsedColumn = {
  key: "_id",
  name: "_id",
  type: "ObjectId",
  displayType: "ObjectId",
  isPrimaryKey: true,
  isNotNull: true,
  isUnique: true,
  hasDefault: true,
  defaultValue: "auto",
  isArray: false,
};

const TIMESTAMP_COLUMNS: ParsedColumn[] = ["createdAt", "updatedAt"].map((key) => ({
  key,
  name: key,
  type: "Date",
  displayType: "Date",
  isPrimaryKey: false,
  isNotNull: true,
  isUnique: false,
  hasDefault: true,
  defaultValue: "timestamps",
  isArray: false,
}));

interface SchemaDeclaration {
  variable: string;
  definition: Expression | undefined;
  options: Expression | undefined;
  line: number;
  file: string;
}

export function parseMongooseSchema(files: ParserFile[], locale: Locale = "tr"): ParsedSchema {
  const usable = files.filter((file) => file.content.trim().length > 0);
  if (usable.length === 0) return emptySchema("mongoose");

  const diagnostics: ParseDiagnostic[] = [];

  try {
    const { project, sourceFiles } = createTsProject(usable);
    diagnostics.push(...syntacticDiagnostics(project, sourceFiles));

    const schemas = new Map<string, SchemaDeclaration>();
    // şema değişkeni → model adı
    const modelNames = new Map<string, string>();

    for (const sourceFile of sourceFiles) {
      collectSchemas(sourceFile, schemas);
      collectModels(sourceFile, modelNames);
    }

    const tables: ParsedTable[] = [];
    const relations: ParsedRelation[] = [];

    for (const [variable, declaration] of schemas) {
      const modelName = modelNames.get(variable) ?? variable;
      const table = buildTable(modelName, declaration);
      const fieldRelations = collectFieldRelations(modelName, table, declaration);
      tables.push(table);
      relations.push(...fieldRelations);
    }

    // `postSchema.index({ title: 1 }, { unique: true })` çağrıları
    for (const sourceFile of sourceFiles) {
      applyIndexCalls(sourceFile, schemas, modelNames, tables);
    }

    const schema: ParsedSchema = {
      orm: "mongoose",
      dialect: "mongo",
      tables,
      enums: [],
      relations,
      diagnostics,
    };

    validateSchema(schema, locale);
    return schema;
  } catch (error) {
    return {
      ...emptySchema("mongoose"),
      diagnostics: [
        ...diagnostics,
        {
          level: "error",
          message: parseFailureMessage(
            locale,
            error instanceof Error ? error.message : String(error),
          ),
        },
      ],
    };
  }
}

function collectSchemas(sourceFile: SourceFile, schemas: Map<string, SchemaDeclaration>): void {
  for (const declaration of sourceFile.getVariableDeclarations()) {
    const initializer = declaration.getInitializer();
    if (!initializer || !Node.isNewExpression(initializer)) continue;

    const callee = initializer.getExpression().getText();
    if (!/(^|\.)Schema$/.test(callee)) continue;

    const args = initializer.getArguments();
    schemas.set(declaration.getName(), {
      variable: declaration.getName(),
      definition: args[0] as Expression | undefined,
      options: args[1] as Expression | undefined,
      line: declaration.getStartLineNumber(),
      file: sourceFile.getBaseName(),
    });
  }
}

/** `mongoose.model('User', userSchema)` → userSchema = 'User' */
function collectModels(sourceFile: SourceFile, modelNames: Map<string, string>): void {
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;

    const callee = node.getExpression();
    const name = Node.isPropertyAccessExpression(callee) ? callee.getName() : callee.getText();
    if (name !== "model") return;

    const args = node.getArguments();
    const modelName = literalValue(args[0]);
    const schemaVariable = args[1]?.getText();
    if (typeof modelName === "string" && schemaVariable) {
      modelNames.set(schemaVariable, modelName);
    }
  });
}

function buildTable(modelName: string, declaration: SchemaDeclaration): ParsedTable {
  const options = objectProperties(declaration.options);
  const explicitCollection = literalValue(options.get("collection"));
  const hasTimestamps = literalValue(options.get("timestamps")) === true;

  const table: ParsedTable = {
    id: modelName,
    // Koleksiyon adı yalnızca açıkça verilmişse kullanılır. Mongoose adı
    // kendi çoğullaştırma kurallarıyla türetir; tahmin etmek yanlış bilgi
    // üretme riski taşıdığı için model adında kalıyoruz.
    name: typeof explicitCollection === "string" ? explicitCollection : modelName,
    dialect: "mongo",
    columns: [IMPLICIT_ID],
    indexes: [],
    compositePrimaryKey: [],
    line: declaration.line,
    file: declaration.file,
  };

  const definition = declaration.definition;
  if (definition && Node.isObjectLiteralExpression(definition)) {
    for (const property of definition.getProperties()) {
      if (!Node.isPropertyAssignment(property)) continue;
      const key = propertyName(property);
      const initializer = property.getInitializer();
      if (!key || !initializer) continue;
      table.columns.push(buildColumn(key, initializer, table));
    }
  }

  if (hasTimestamps) table.columns.push(...TIMESTAMP_COLUMNS);

  return table;
}

function buildColumn(key: string, initializer: Expression, table: ParsedTable): ParsedColumn {
  let node: Expression = initializer;
  let isArray = false;

  // `tags: [String]` ya da `authors: [{ type: ObjectId, ref: 'User' }]`
  if (Node.isArrayLiteralExpression(node)) {
    isArray = true;
    const first = node.getElements()[0];
    if (first) node = first as Expression;
  }

  const descriptor = Node.isObjectLiteralExpression(node) ? objectProperties(node) : null;
  const typeNode = descriptor ? descriptor.get("type") : node;

  // `type` anahtarı olmayan obje literali gömülü alt belgedir.
  const isEmbedded = Boolean(descriptor) && !typeNode;
  const type = isEmbedded ? "Object" : typeName(typeNode);

  const enumValues = descriptor ? stringArrayElements(descriptor.get("enum")) : [];
  const reference = descriptor ? literalValue(descriptor.get("ref")) : undefined;
  const defaultNode = descriptor?.get("default");
  const isUnique = descriptor ? literalValue(descriptor.get("unique")) === true : false;

  if (descriptor && literalValue(descriptor.get("index")) === true) {
    table.indexes.push({ columns: [key], isUnique: false });
  }

  return {
    key,
    name: key,
    type,
    displayType: `${enumValues.length > 0 ? `enum(${type})` : type}${isArray ? "[]" : ""}`,
    isPrimaryKey: false,
    isNotNull: descriptor ? literalValue(descriptor.get("required")) === true : false,
    isUnique,
    hasDefault: Boolean(defaultNode),
    defaultValue: defaultNode?.getText(),
    isArray,
    enumValues: enumValues.length > 0 ? enumValues : undefined,
    reference:
      typeof reference === "string"
        ? { table: reference, column: "_id", isComposite: false }
        : undefined,
  };
}

/** `ref:` içeren her alan aynı zamanda mantıksal bir ilişkidir. */
function collectFieldRelations(
  modelName: string,
  table: ParsedTable,
  declaration: SchemaDeclaration,
): ParsedRelation[] {
  return table.columns
    .filter((column) => column.reference)
    .map((column) => ({
      id: `${modelName}.${column.key}`,
      kind: column.isArray ? ("many" as const) : ("one" as const),
      sourceTable: modelName,
      fieldName: column.key,
      targetTable: column.reference!.table,
      fields: [column.key],
      references: ["_id"],
      line: declaration.line,
      file: declaration.file,
    }));
}

function applyIndexCalls(
  sourceFile: SourceFile,
  schemas: Map<string, SchemaDeclaration>,
  modelNames: Map<string, string>,
  tables: ParsedTable[],
): void {
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;

    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "index") return;

    const variable = callee.getExpression().getText();
    if (!schemas.has(variable)) return;

    const tableId = modelNames.get(variable) ?? variable;
    const table = tables.find((item) => item.id === tableId);
    if (!table) return;

    const args = node.getArguments();
    const keys = objectProperties(args[0] as Expression | undefined);
    const columns = [...keys.keys()];
    if (columns.length === 0) return;

    const options = objectProperties(args[1] as Expression | undefined);
    table.indexes.push({
      name: typeof literalValue(options.get("name")) === "string"
        ? (literalValue(options.get("name")) as string)
        : undefined,
      columns,
      isUnique: literalValue(options.get("unique")) === true,
    });
  });
}

function objectProperties(node: Expression | undefined): Map<string, Expression> {
  const result = new Map<string, Expression>();
  if (!node || !Node.isObjectLiteralExpression(node)) return result;

  for (const property of node.getProperties()) {
    if (!Node.isPropertyAssignment(property)) continue;
    const key = propertyName(property);
    const initializer = property.getInitializer();
    if (key && initializer) result.set(key, initializer);
  }

  return result;
}

/** `Schema.Types.ObjectId` → `ObjectId`, `String` → `String` */
function typeName(node: Expression | undefined): string {
  if (!node) return "Mixed";
  const text = node.getText();
  return text.split(".").pop() ?? text;
}
