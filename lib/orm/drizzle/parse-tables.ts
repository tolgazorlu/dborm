import { Node, type VariableDeclaration } from "ts-morph";

import { fileLabel } from "../ts-project";
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

const TABLE_CREATOR_FACTORIES: Record<string, Dialect> = {
  pgTableCreator: "pg",
  mysqlTableCreator: "mysql",
  sqliteTableCreator: "sqlite",
};

const SCHEMA_FACTORIES: Record<string, Dialect> = {
  pgSchema: "pg",
  mysqlSchema: "mysql",
};

const ENUM_FACTORIES: Record<string, Dialect> = {
  pgEnum: "pg",
  mysqlEnum: "mysql",
};

/** A `pgTableCreator` result, or a table factory imported under an alias. */
export interface TableFactory {
  dialect: Dialect;
  /** Prefix the creator callback puts in front of every table name. */
  prefix: string;
  /** Suffix the creator callback appends to every table name. */
  suffix: string;
}

/** A `pgSchema("app")` object, whose `.table(...)` method declares tables. */
export interface SchemaObject {
  dialect: Dialect;
  name?: string;
}

/**
 * Everything a file-level pre-pass learns before tables are read: the local
 * names that behave like `pgTable`, the `pgSchema` objects and the enums.
 */
export interface DrizzleScope {
  factories: Map<string, TableFactory>;
  schemas: Map<string, SchemaObject>;
  enums: Map<string, ParsedEnum>;
}

export function createScope(): DrizzleScope {
  const factories = new Map<string, TableFactory>();
  for (const [name, dialect] of Object.entries(TABLE_FACTORIES)) {
    factories.set(name, { dialect, prefix: "", suffix: "" });
  }
  return { factories, schemas: new Map(), enums: new Map() };
}

/**
 * Registers `const createTable = pgTableCreator(...)` and
 * `const schema = pgSchema("app")` declarations so that the tables they go on
 * to declare are recognised as tables.
 */
export function collectScopeDeclaration(declaration: VariableDeclaration, scope: DrizzleScope): void {
  const initializer = unwrapDeclaration(declaration.getInitializer());
  if (!initializer || !Node.isCallExpression(initializer)) return;

  const callee = initializer.getExpression();
  if (!Node.isIdentifier(callee)) return;

  const calleeName = callee.getText();
  const creatorDialect = TABLE_CREATOR_FACTORIES[calleeName];
  if (creatorDialect) {
    scope.factories.set(declaration.getName(), {
      dialect: creatorDialect,
      ...namePattern(initializer.getArguments()[0]),
    });
    return;
  }

  const schemaDialect = SCHEMA_FACTORIES[calleeName];
  if (schemaDialect) {
    scope.schemas.set(declaration.getName(), {
      dialect: schemaDialect,
      name: stringArg(initializer.getArguments(), 0),
    });
  }
}

/**
 * Reads the fixed parts out of a table-creator callback such as
 * `(name) => `acme_${name}`` so table names show up the way the database sees
 * them. Anything more involved is left alone.
 */
function namePattern(callback: Node | undefined): { prefix: string; suffix: string } {
  const empty = { prefix: "", suffix: "" };
  if (!callback || !(Node.isArrowFunction(callback) || Node.isFunctionExpression(callback))) {
    return empty;
  }

  const body = unwrapToExpression(callback);
  if (!body || !Node.isTemplateExpression(body)) return empty;

  const spans = body.getTemplateSpans();
  if (spans.length !== 1) return empty;

  return {
    prefix: body.getHead().getLiteralText(),
    suffix: spans[0].getLiteral().getLiteralText(),
  };
}

/** Unwraps `as const`, `satisfies X` and parentheses around a declaration. */
function unwrapDeclaration(node: Node | undefined): Node | undefined {
  let current = node;
  while (current) {
    if (Node.isAsExpression(current) || Node.isSatisfiesExpression(current)) {
      current = current.getExpression();
      continue;
    }
    if (Node.isParenthesizedExpression(current) || Node.isTypeAssertion(current)) {
      current = current.getExpression();
      continue;
    }
    return current;
  }
  return current;
}

const DEFAULT_CALLS = [
  "default",
  "defaultNow",
  "defaultRandom",
  "$default",
  "$defaultFn",
  "generatedAlwaysAsIdentity",
  "generatedByDefaultAsIdentity",
];

interface TableSite {
  dialect: Dialect;
  prefix: string;
  suffix: string;
  schemaName?: string;
}

export function isTableDeclaration(declaration: VariableDeclaration, scope: DrizzleScope): boolean {
  return Boolean(tableSiteOf(declaration, scope));
}

export function isEnumDeclaration(declaration: VariableDeclaration, scope: DrizzleScope): boolean {
  const initializer = unwrapDeclaration(declaration.getInitializer());
  if (!initializer || !Node.isCallExpression(initializer)) return false;

  const callee = initializer.getExpression();
  if (Node.isIdentifier(callee)) return callee.getText() in ENUM_FACTORIES;

  // `appSchema.enum("role", [...])` on a pgSchema object.
  return (
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === "enum" &&
    scope.schemas.has(callee.getExpression().getText())
  );
}

function tableSiteOf(
  declaration: VariableDeclaration,
  scope: DrizzleScope,
): TableSite | undefined {
  const initializer = unwrapDeclaration(declaration.getInitializer());
  if (!initializer || !Node.isCallExpression(initializer)) return undefined;

  const callee = initializer.getExpression();

  if (Node.isIdentifier(callee)) {
    const factory = scope.factories.get(callee.getText());
    return factory ? { ...factory } : undefined;
  }

  // `appSchema.table("users", {...})` on a pgSchema / mysqlSchema object.
  if (Node.isPropertyAccessExpression(callee) && callee.getName() === "table") {
    const owner = scope.schemas.get(callee.getExpression().getText());
    if (owner) {
      return { dialect: owner.dialect, prefix: "", suffix: "", schemaName: owner.name };
    }
  }

  return undefined;
}

export function parseEnumDeclaration(declaration: VariableDeclaration): ParsedEnum | undefined {
  const initializer = unwrapDeclaration(declaration.getInitializer());
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
  scope: DrizzleScope,
): ParsedTable | undefined {
  const site = tableSiteOf(declaration, scope);
  const initializer = unwrapDeclaration(declaration.getInitializer());
  if (!site || !initializer || !Node.isCallExpression(initializer)) return undefined;

  const enums = scope.enums;
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
    name: tableName(site, stringArg(args, 0) ?? declaration.getName()),
    dialect: site.dialect,
    columns,
    indexes: [],
    compositePrimaryKey: [],
    line: declaration.getStartLineNumber(),
    file: fileLabel(declaration.getSourceFile()),
  };

  applyTableExtras(table, args[2]);
  return table;
}

/** Applies the creator prefix/suffix and the schema qualifier to a table name. */
function tableName(site: TableSite, declared: string): string {
  const withAffixes = `${site.prefix}${declared}${site.suffix}`;
  return site.schemaName ? `${site.schemaName}.${withAffixes}` : withAffixes;
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
