import { Node, type ClassDeclaration, type SourceFile } from "ts-morph";

import type { Locale } from "@/lib/i18n/locales";
import { literalValue, stringArrayElements } from "../ast-utils";
import {
  entityTableName,
  findDecorator,
  hasDecorator,
  inverseFieldName,
  optionStringArray,
  propertyTypeText,
  readDecorators,
  relationTarget,
  unwrapTypeText,
  type ReadDecorator,
} from "../decorators";
import { createTsProject, syntacticDiagnostics } from "../ts-project";
import {
  emptySchema,
  type Dialect,
  type ParseDiagnostic,
  type ParsedColumn,
  type ParsedRelation,
  type ParsedSchema,
  type ParsedTable,
  type ParserFile,
} from "../types";
import { parseFailureMessage, validateSchema } from "../validate";

const RELATION_DECORATORS = ["ManyToOne", "OneToMany", "OneToOne", "ManyToMany"];

const DATE_COLUMNS: Record<string, string> = {
  CreateDateColumn: "CURRENT_TIMESTAMP",
  UpdateDateColumn: "CURRENT_TIMESTAMP",
  DeleteDateColumn: "NULL",
};

const TS_TYPE_MAP: Record<string, string> = {
  string: "varchar",
  number: "int",
  boolean: "boolean",
  Date: "timestamp",
  object: "json",
  any: "json",
};

const PROVIDER_DIALECTS: Record<string, Dialect> = {
  postgres: "pg",
  cockroachdb: "pg",
  mysql: "mysql",
  mariadb: "mysql",
  sqlite: "sqlite",
  "better-sqlite3": "sqlite",
  mssql: "sqlserver",
  mongodb: "mongo",
};

export function parseTypeOrmSchema(files: ParserFile[], locale: Locale = "tr"): ParsedSchema {
  const usable = files.filter((file) => file.content.trim().length > 0);
  if (usable.length === 0) return emptySchema("typeorm");

  const diagnostics: ParseDiagnostic[] = [];

  try {
    const { project, sourceFiles } = createTsProject(usable);
    diagnostics.push(...syntacticDiagnostics(project, sourceFiles));

    const dialect = findDialect(sourceFiles);
    const entities = sourceFiles.flatMap((sourceFile) =>
      sourceFile.getClasses().filter((declaration) => isEntity(declaration)),
    );
    const entityNames = new Set(entities.map((declaration) => declaration.getName() ?? ""));

    const tables: ParsedTable[] = [];
    const relations: ParsedRelation[] = [];

    for (const declaration of entities) {
      const parsed = parseEntity(declaration, dialect, entityNames);
      if (!parsed) continue;
      tables.push(parsed.table);
      relations.push(...parsed.relations);
    }

    const schema: ParsedSchema = {
      orm: "typeorm",
      dialect,
      tables,
      enums: [],
      relations,
      diagnostics,
    };

    validateSchema(schema, locale);
    return schema;
  } catch (error) {
    return {
      ...emptySchema("typeorm"),
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

function isEntity(declaration: ClassDeclaration): boolean {
  return hasDecorator(readDecorators(declaration), "Entity", "ViewEntity", "ChildEntity");
}

function findDialect(sourceFiles: SourceFile[]): Dialect {
  for (const sourceFile of sourceFiles) {
    const match = /type:\s*["']([\w-]+)["']/.exec(sourceFile.getFullText());
    const dialect = match ? PROVIDER_DIALECTS[match[1]] : undefined;
    if (dialect) return dialect;
  }
  return "unknown";
}

function parseEntity(
  declaration: ClassDeclaration,
  dialect: Dialect,
  entityNames: Set<string>,
): { table: ParsedTable; relations: ParsedRelation[] } | undefined {
  const className = declaration.getName();
  if (!className) return undefined;

  const classDecorators = readDecorators(declaration);
  const table: ParsedTable = {
    id: className,
    name: entityTableName(findDecorator(classDecorators, "Entity", "ViewEntity"), className),
    dialect,
    columns: [],
    indexes: [],
    compositePrimaryKey: [],
    line: declaration.getStartLineNumber(),
    file: declaration.getSourceFile().getBaseName(),
  };

  applyClassIndexes(table, classDecorators);

  const relations: ParsedRelation[] = [];
  const pending: {
    fieldName: string;
    target: string;
    joinColumn?: string;
    onDelete?: string;
    line: number;
  }[] = [];

  for (const property of declaration.getProperties()) {
    const name = property.getName();
    const decorators = readDecorators(property);
    const relation = findDecorator(decorators, ...RELATION_DECORATORS);

    if (relation) {
      const target = relationTarget(relation);
      if (!target || !entityNames.has(target)) continue;

      const isMany = relation.name === "OneToMany" || relation.name === "ManyToMany";
      const joinColumn = findDecorator(decorators, "JoinColumn");
      const onDelete = relation.options.onDelete;

      relations.push({
        id: `${className}.${name}`,
        kind: isMany ? "many" : "one",
        sourceTable: className,
        fieldName: name,
        targetTable: target,
        fields: [],
        references: [],
        relationName: inverseFieldName(relation),
        line: property.getStartLineNumber(),
        file: table.file,
      });

      if (!isMany) {
        pending.push({
          fieldName: name,
          target,
          joinColumn: typeof joinColumn?.options.name === "string" ? joinColumn.options.name : undefined,
          onDelete: typeof onDelete === "string" ? onDelete.toLowerCase() : undefined,
          line: property.getStartLineNumber(),
        });
      }
      continue;
    }

    const column = parseColumn(name, decorators, propertyTypeText(property));
    if (column) {
      table.columns.push(column);
      if (hasDecorator(decorators, "Index")) {
        table.indexes.push({ columns: [column.key], isUnique: false });
      }
    }
  }

  for (const item of pending) {
    const column =
      (item.joinColumn && table.columns.find((entry) => entry.name === item.joinColumn)) ||
      table.columns.find((entry) => entry.key === `${item.fieldName}Id`);
    if (!column || column.reference) continue;

    column.reference = {
      table: item.target,
      column: "id",
      onDelete: item.onDelete,
      isComposite: false,
    };

    const relation = relations.find((entry) => entry.id === `${className}.${item.fieldName}`);
    if (relation) {
      relation.fields = [column.key];
      relation.references = ["id"];
    }
  }

  return { table, relations };
}

function parseColumn(
  name: string,
  decorators: ReadDecorator[],
  typeText: string,
): ParsedColumn | undefined {
  const primaryGenerated = findDecorator(decorators, "PrimaryGeneratedColumn");
  const primary = findDecorator(decorators, "PrimaryColumn");
  const column = findDecorator(decorators, "Column");
  const dateColumn = decorators.find((item) => item.name in DATE_COLUMNS);

  const decorator = primaryGenerated ?? primary ?? column ?? dateColumn;
  if (!decorator) return undefined;

  const options = decorator.options;
  const { base, isArray, isNullable } = unwrapTypeText(typeText);

  const explicitType =
    (typeof options.type === "string" ? options.type : undefined) ??
    (typeof literalValue(decorator.args[0]) === "string"
      ? (literalValue(decorator.args[0]) as string)
      : undefined);

  const type = explicitType ?? (dateColumn ? "timestamp" : (TS_TYPE_MAP[base] ?? base));
  const length = typeof options.length === "number" ? options.length : undefined;
  const enumValues = optionStringArray(decorator, "enum");

  return {
    key: name,
    name: typeof options.name === "string" ? options.name : name,
    type,
    displayType: `${length ? `${type}(${length})` : type}${isArray || options.array === true ? "[]" : ""}`,
    isPrimaryKey: Boolean(primaryGenerated || primary),
    isNotNull: !(options.nullable === true || isNullable),
    isUnique: options.unique === true,
    hasDefault: Boolean(primaryGenerated) || options.default !== undefined || Boolean(dateColumn),
    defaultValue: dateColumn
      ? DATE_COLUMNS[dateColumn.name]
      : options.default !== undefined
        ? String(options.default)
        : primaryGenerated
          ? "auto"
          : undefined,
    isArray: isArray || options.array === true,
    enumValues: enumValues.length > 0 ? enumValues : undefined,
  };
}

function applyClassIndexes(table: ParsedTable, decorators: ReadDecorator[]): void {
  for (const decorator of decorators) {
    if (decorator.name !== "Index" && decorator.name !== "Unique") continue;

    const arrayArg = decorator.args.find(Node.isArrayLiteralExpression);
    const columns = stringArrayElements(arrayArg);
    if (columns.length === 0) continue;

    const name = literalValue(decorator.args[0]);
    table.indexes.push({
      name: typeof name === "string" ? name : undefined,
      columns,
      isUnique: decorator.name === "Unique",
    });
  }
}
