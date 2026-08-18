import { Node, type VariableDeclaration } from "ts-morph";

import {
  arrayElements,
  findCall,
  hasCall,
  literalValue,
  objectArgToRecord,
  propertyName,
  qualifiedReference,
  referencedColumnKeys,
  referencedTable,
  stringArg,
  stringArrayElements,
  unwrapChain,
  unwrapToExpression,
  type UnwrappedChain,
} from "../ast-utils";
import type {
  ColumnReference,
  Dialect,
  ParsedColumn,
  ParsedEnum,
  ParsedIndex,
  ParsedTable,
} from "../types";

const TABLE_FACTORIES: Record<string, Dialect> = {
  pgTable: "pg",
  mysqlTable: "mysql",
  sqliteTable: "sqlite",
};

const ENUM_FACTORIES: Record<string, Dialect> = {
  pgEnum: "pg",
  mysqlEnum: "mysql",
};

const DEFAULT_CALLS = [
  "default",
  "defaultNow",
  "defaultRandom",
  "$default",
  "$defaultFn",
  "generatedAlwaysAsIdentity",
  "generatedByDefaultAsIdentity",
];

export function isTableDeclaration(declaration: VariableDeclaration): boolean {
  return Boolean(tableFactoryOf(declaration));
}

export function isEnumDeclaration(declaration: VariableDeclaration): boolean {
  const initializer = declaration.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return false;
  const callee = initializer.getExpression();
  return Node.isIdentifier(callee) && callee.getText() in ENUM_FACTORIES;
}

function tableFactoryOf(declaration: VariableDeclaration): Dialect | undefined {
  const initializer = declaration.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return undefined;
  const callee = initializer.getExpression();
  if (!Node.isIdentifier(callee)) return undefined;
  return TABLE_FACTORIES[callee.getText()];
}

export function parseEnumDeclaration(declaration: VariableDeclaration): ParsedEnum | undefined {
  const initializer = declaration.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return undefined;

  const args = initializer.getArguments();
  return {
    id: declaration.getName(),
    name: stringArg(args, 0) ?? declaration.getName(),
    values: stringArrayElements(args[1]),
  };
}

export function parseTableDeclaration(
  declaration: VariableDeclaration,
  enums: Map<string, ParsedEnum>,
): ParsedTable | undefined {
  const dialect = tableFactoryOf(declaration);
  const initializer = declaration.getInitializer();
  if (!dialect || !initializer || !Node.isCallExpression(initializer)) return undefined;

  const args = initializer.getArguments();
  const columnsArg = args[1];
  const columns: ParsedColumn[] = [];

  if (columnsArg && Node.isObjectLiteralExpression(columnsArg)) {
    for (const property of columnsArg.getProperties()) {
      if (!Node.isPropertyAssignment(property)) continue;
      const key = propertyName(property);
      if (!key) continue;
      const column = parseColumn(key, property.getInitializer(), enums);
      if (column) columns.push(column);
    }
  }

  const table: ParsedTable = {
    id: declaration.getName(),
    name: stringArg(args, 0) ?? declaration.getName(),
    dialect,
    columns,
    indexes: [],
    compositePrimaryKey: [],
    line: declaration.getStartLineNumber(),
    file: declaration.getSourceFile().getBaseName(),
  };

  applyTableExtras(table, args[2]);
  return table;
}

function parseColumn(
  key: string,
  initializer: Node | undefined,
  enums: Map<string, ParsedEnum>,
): ParsedColumn | undefined {
  if (!initializer) return undefined;

  const chain = unwrapChain(initializer);
  if (!chain.baseName) return undefined;

  const options = objectArgToRecord(
    chain.baseArgs.find((arg) => Node.isObjectLiteralExpression(arg)),
  );
  const enumDefinition = enums.get(chain.baseName);
  const isArray = hasCall(chain, "array");

  const inlineEnumValues = chain.baseArgs
    .filter(Node.isObjectLiteralExpression)
    .flatMap((arg) => arg.getProperties())
    .filter(Node.isPropertyAssignment)
    .filter((property) => propertyName(property) === "enum")
    .flatMap((property) => stringArrayElements(property.getInitializer()));

  const defaultCall = chain.calls.find((call) => DEFAULT_CALLS.includes(call.name));

  return {
    key,
    name: stringArg(chain.baseArgs, 0) ?? key,
    type: chain.baseName,
    displayType: buildDisplayType(chain, options, enumDefinition, isArray),
    isPrimaryKey: hasCall(chain, "primaryKey"),
    isNotNull: hasCall(chain, "notNull"),
    isUnique: hasCall(chain, "unique"),
    hasDefault: Boolean(defaultCall),
    defaultValue: defaultCall
      ? defaultCall.args.length > 0
        ? defaultCall.args.map((arg) => arg.getText()).join(", ")
        : `${defaultCall.name}()`
      : undefined,
    isArray,
    enumName: enumDefinition?.id,
    enumValues: enumDefinition?.values ?? (inlineEnumValues.length ? inlineEnumValues : undefined),
    reference: parseColumnReference(chain),
  };
}

function parseColumnReference(chain: UnwrappedChain): ColumnReference | undefined {
  const call = findCall(chain, "references");
  if (!call) return undefined;

  const target = qualifiedReference(call.args[0]);
  if (!target) return undefined;

  const options = objectArgToRecord(call.args[1]);
  return {
    table: target.object,
    column: target.property,
    onDelete: typeof options.onDelete === "string" ? options.onDelete : undefined,
    onUpdate: typeof options.onUpdate === "string" ? options.onUpdate : undefined,
    isComposite: false,
  };
}

function buildDisplayType(
  chain: UnwrappedChain,
  options: Record<string, unknown>,
  enumDefinition: ParsedEnum | undefined,
  isArray: boolean,
): string {
  let display = enumDefinition ? `enum(${enumDefinition.name})` : chain.baseName ?? "unknown";

  if (typeof options.length === "number") {
    display = `${display}(${options.length})`;
  } else if (typeof options.precision === "number") {
    display =
      typeof options.scale === "number"
        ? `${display}(${options.precision}, ${options.scale})`
        : `${display}(${options.precision})`;
  } else if (options.withTimezone === true) {
    display = `${display} tz`;
  }

  return isArray ? `${display}[]` : display;
}

function applyTableExtras(table: ParsedTable, extrasArg: Node | undefined): void {
  const body = unwrapToExpression(extrasArg);
  if (!body) return;

  const entries: Node[] = [];
  if (Node.isArrayLiteralExpression(body)) {
    entries.push(...arrayElements(body));
  } else if (Node.isObjectLiteralExpression(body)) {
    for (const property of body.getProperties()) {
      if (Node.isPropertyAssignment(property)) {
        const initializer = property.getInitializer();
        if (initializer) entries.push(initializer);
      }
    }
  }

  for (const entry of entries) {
    const chain = unwrapChain(entry);
    switch (chain.baseName) {
      case "index":
      case "uniqueIndex": {
        const index = parseIndex(chain, chain.baseName === "uniqueIndex");
        if (index) table.indexes.push(index);
        break;
      }
      case "unique": {
        const index = parseIndex(chain, true);
        if (index) table.indexes.push(index);
        break;
      }
      case "primaryKey": {
        const options = chain.baseArgs.find(Node.isObjectLiteralExpression);
        const columnsProperty = options
          ?.getProperties()
          .find((property) => propertyName(property) === "columns");
        if (columnsProperty && Node.isPropertyAssignment(columnsProperty)) {
          table.compositePrimaryKey = referencedColumnKeys(columnsProperty.getInitializer());
        } else {
          table.compositePrimaryKey = chain.baseArgs
            .map((arg) => qualifiedReference(arg)?.property)
            .filter((value): value is string => Boolean(value));
        }
        break;
      }
      case "foreignKey": {
        applyCompositeForeignKey(table, chain);
        break;
      }
      default:
        break;
    }
  }
}

function parseIndex(chain: UnwrappedChain, isUnique: boolean): ParsedIndex | undefined {
  const onCall = findCall(chain, "on") ?? findCall(chain, "using");
  const columns = (onCall?.args ?? [])
    .map((arg) => qualifiedReference(arg)?.property)
    .filter((value): value is string => Boolean(value));

  if (columns.length === 0) return undefined;

  return {
    name: stringArg(chain.baseArgs, 0),
    columns,
    isUnique,
  };
}

function applyCompositeForeignKey(table: ParsedTable, chain: UnwrappedChain): void {
  const options = chain.baseArgs.find(Node.isObjectLiteralExpression);
  if (!options) return;

  const getInitializer = (name: string): Node | undefined => {
    const property = options.getProperties().find((item) => propertyName(item) === name);
    return property && Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
  };

  const localColumns = referencedColumnKeys(getInitializer("columns"));
  const foreignInitializer = getInitializer("foreignColumns");
  const foreignColumns = referencedColumnKeys(foreignInitializer);
  const targetTable = referencedTable(foreignInitializer);
  if (!targetTable || localColumns.length === 0) return;

  const onDelete = literalValue(findCall(chain, "onDelete")?.args[0]);
  const onUpdate = literalValue(findCall(chain, "onUpdate")?.args[0]);

  localColumns.forEach((columnKey, index) => {
    const column = table.columns.find((item) => item.key === columnKey);
    if (!column || column.reference) return;
    column.reference = {
      table: targetTable,
      column: foreignColumns[index] ?? foreignColumns[0] ?? "id",
      onDelete: typeof onDelete === "string" ? onDelete : undefined,
      onUpdate: typeof onUpdate === "string" ? onUpdate : undefined,
      isComposite: true,
    };
  });
}
