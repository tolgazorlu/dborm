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

const IMPLICIT_ID: ParsedColumn = {
  key: "id",
  name: "id",
  type: "INTEGER",
  displayType: "INTEGER",
  isPrimaryKey: true,
  isNotNull: true,
  isUnique: true,
  hasDefault: true,
  defaultValue: "autoIncrement",
  isArray: false,
};

const TIMESTAMP_KEYS = ["createdAt", "updatedAt"];

interface ModelDeclaration {
  id: string;
  table: ParsedTable;
}

export function parseSequelizeSchema(files: ParserFile[], locale: Locale = "tr"): ParsedSchema {
  const usable = files.filter((file) => file.content.trim().length > 0);
  if (usable.length === 0) return emptySchema("sequelize");

  const diagnostics: ParseDiagnostic[] = [];

  try {
    const { project, sourceFiles } = createTsProject(usable);
    diagnostics.push(...syntacticDiagnostics(project, sourceFiles));

    const models = new Map<string, ModelDeclaration>();
    for (const sourceFile of sourceFiles) {
      collectDefineCalls(sourceFile, models);
      collectInitCalls(sourceFile, models);
    }

    const relations: ParsedRelation[] = [];
    for (const sourceFile of sourceFiles) {
      relations.push(...collectAssociations(sourceFile, models));
    }

    const schema: ParsedSchema = {
      orm: "sequelize",
      dialect: "unknown",
      tables: [...models.values()].map((model) => model.table),
      enums: [],
      relations,
      diagnostics,
    };

    validateSchema(schema, locale);
    return schema;
  } catch (error) {
    return {
      ...emptySchema("sequelize"),
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

function collectDefineCalls(sourceFile: SourceFile, models: Map<string, ModelDeclaration>): void {
  for (const declaration of sourceFile.getVariableDeclarations()) {
    const initializer = declaration.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) continue;

    const callee = initializer.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "define") continue;

    const args = initializer.getArguments();
    const modelName = literalValue(args[0]);
    const table = buildTable(
      declaration.getName(),
      typeof modelName === "string" ? modelName : declaration.getName(),
      args[1] as Expression | undefined,
      args[2] as Expression | undefined,
      declaration.getStartLineNumber(),
      sourceFile.getBaseName(),
    );

    models.set(declaration.getName(), { id: declaration.getName(), table });
  }
}

function collectInitCalls(sourceFile: SourceFile, models: Map<string, ModelDeclaration>): void {
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;

    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "init") return;

    const className = callee.getExpression().getText();
    if (models.has(className)) return;

    const args = node.getArguments();
    const options = objectProperties(args[1] as Expression | undefined);
    const modelName = literalValue(options.get("modelName"));

    const table = buildTable(
      className,
      typeof modelName === "string" ? modelName : className,
      args[0] as Expression | undefined,
      args[1] as Expression | undefined,
      node.getStartLineNumber(),
      sourceFile.getBaseName(),
    );

    models.set(className, { id: className, table });
  });
}

function buildTable(
  id: string,
  modelName: string,
  attributes: Expression | undefined,
  optionsNode: Expression | undefined,
  line: number,
  file: string,
): ParsedTable {
  const options = objectProperties(optionsNode);
  const tableName = literalValue(options.get("tableName"));

  const table: ParsedTable = {
    id,
    name: typeof tableName === "string" ? tableName : modelName,
    dialect: "unknown",
    columns: [],
    indexes: [],
    compositePrimaryKey: [],
    line,
    file,
  };

  if (attributes && Node.isObjectLiteralExpression(attributes)) {
    for (const property of attributes.getProperties()) {
      if (!Node.isPropertyAssignment(property)) continue;
      const key = propertyName(property);
      const initializer = property.getInitializer();
      if (!key || !initializer) continue;
      table.columns.push(buildColumn(key, initializer, table));
    }
  }

  if (!table.columns.some((column) => column.isPrimaryKey)) {
    table.columns.unshift(IMPLICIT_ID);
  }

  if (literalValue(options.get("timestamps")) !== false) {
    for (const key of TIMESTAMP_KEYS) {
      if (table.columns.some((column) => column.key === key)) continue;
      table.columns.push({
        key,
        name: key,
        type: "DATE",
        displayType: "DATE",
        isPrimaryKey: false,
        isNotNull: true,
        isUnique: false,
        hasDefault: true,
        defaultValue: "timestamps",
        isArray: false,
      });
    }
  }

  applyIndexOption(table, options.get("indexes"));
  return table;
}

function buildColumn(key: string, initializer: Expression, table: ParsedTable): ParsedColumn {
  const descriptor = Node.isObjectLiteralExpression(initializer) ? objectProperties(initializer) : null;
  const typeNode = descriptor ? descriptor.get("type") : initializer;
  const type = dataTypeName(typeNode);

  const fieldName = descriptor ? literalValue(descriptor.get("field")) : undefined;
  const defaultNode = descriptor?.get("defaultValue");
  const autoIncrement = descriptor ? literalValue(descriptor.get("autoIncrement")) === true : false;
  const references = descriptor ? objectProperties(descriptor.get("references")) : new Map();
  const referencedModel = references.get("model");
  const referencedKey = literalValue(references.get("key"));

  if (descriptor && literalValue(descriptor.get("index")) === true) {
    table.indexes.push({ columns: [key], isUnique: false });
  }

  return {
    key,
    name: typeof fieldName === "string" ? fieldName : key,
    type,
    displayType: type,
    isPrimaryKey: descriptor ? literalValue(descriptor.get("primaryKey")) === true : false,
    isNotNull: descriptor ? literalValue(descriptor.get("allowNull")) === false : false,
    isUnique: descriptor ? literalValue(descriptor.get("unique")) === true : false,
    hasDefault: Boolean(defaultNode) || autoIncrement,
    defaultValue: autoIncrement ? "autoIncrement" : defaultNode?.getText(),
    isArray: type.startsWith("ARRAY"),
    enumValues: descriptor ? enumValuesOf(descriptor.get("type")) : undefined,
    reference: referencedModel
      ? {
          table: modelReferenceName(referencedModel),
          column: typeof referencedKey === "string" ? referencedKey : "id",
          isComposite: false,
        }
      : undefined,
  };
}

function collectAssociations(
  sourceFile: SourceFile,
  models: Map<string, ModelDeclaration>,
): ParsedRelation[] {
  const relations: ParsedRelation[] = [];

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;

    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return;

    const kind = callee.getName();
    if (!["belongsTo", "hasMany", "hasOne", "belongsToMany"].includes(kind)) return;

    const sourceId = callee.getExpression().getText();
    const args = node.getArguments();
    const targetId = args[0]?.getText();
    if (!models.has(sourceId) || !targetId || !models.has(targetId)) return;

    const options = objectProperties(args[1] as Expression | undefined);
    const foreignKeyValue = literalValue(options.get("foreignKey"));
    const onDelete = literalValue(options.get("onDelete"));
    const foreignKey =
      typeof foreignKeyValue === "string"
        ? foreignKeyValue
        : `${lowerFirst(kind === "belongsTo" ? targetId : sourceId)}Id`;

    const childId = kind === "belongsTo" ? sourceId : targetId;
    const parentId = kind === "belongsTo" ? targetId : sourceId;
    const isMany = kind === "hasMany" || kind === "belongsToMany";

    relations.push({
      id: `${sourceId}.${kind}:${targetId}`,
      kind: isMany ? "many" : "one",
      sourceTable: sourceId,
      fieldName: kind,
      targetTable: targetId,
      fields: kind === "belongsTo" ? [foreignKey] : [],
      references: kind === "belongsTo" ? ["id"] : [],
      line: node.getStartLineNumber(),
      file: sourceFile.getBaseName(),
    });

    if (kind === "belongsToMany") return;
    attachForeignKey(models.get(childId)!.table, foreignKey, parentId, onDelete);
  });

  return relations;
}

function attachForeignKey(
  table: ParsedTable,
  foreignKey: string,
  targetTable: string,
  onDelete: unknown,
): void {
  let column = table.columns.find((item) => item.key === foreignKey);

  if (!column) {
    column = {
      key: foreignKey,
      name: foreignKey,
      type: "INTEGER",
      displayType: "INTEGER",
      isPrimaryKey: false,
      isNotNull: false,
      isUnique: false,
      hasDefault: false,
      isArray: false,
    };
    table.columns.push(column);
  }

  if (column.reference) return;
  column.reference = {
    table: targetTable,
    column: "id",
    onDelete: typeof onDelete === "string" ? onDelete.toLowerCase() : undefined,
    isComposite: false,
  };
}

function applyIndexOption(table: ParsedTable, node: Expression | undefined): void {
  if (!node || !Node.isArrayLiteralExpression(node)) return;

  for (const element of node.getElements()) {
    const entry = objectProperties(element as Expression);
    const fields = stringArrayElements(entry.get("fields"));
    if (fields.length === 0) continue;

    const name = literalValue(entry.get("name"));
    table.indexes.push({
      name: typeof name === "string" ? name : undefined,
      columns: fields,
      isUnique: literalValue(entry.get("unique")) === true,
    });
  }
}

function dataTypeName(node: Expression | undefined): string {
  if (!node) return "UNKNOWN";

  if (Node.isCallExpression(node)) {
    const base = dataTypeName(node.getExpression() as Expression);
    const args = node
      .getArguments()
      .map((argument) => {
        const value = literalValue(argument);
        return value === undefined ? argument.getText() : String(value);
      })
      .join(", ");
    return args ? `${base}(${args})` : base;
  }

  const text = node.getText();
  return text.startsWith("DataTypes.") ? text.slice("DataTypes.".length) : text;
}

function enumValuesOf(node: Expression | undefined): string[] | undefined {
  if (!node || !Node.isCallExpression(node)) return undefined;
  if (!/ENUM$/.test(node.getExpression().getText())) return undefined;

  const values = node
    .getArguments()
    .map((argument) => literalValue(argument))
    .filter((value): value is string => typeof value === "string");

  return values.length > 0 ? values : undefined;
}

function modelReferenceName(node: Expression): string {
  const value = literalValue(node);
  return typeof value === "string" ? value : node.getText();
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

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
