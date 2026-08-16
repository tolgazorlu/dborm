import { Node, type ClassDeclaration } from "ts-morph";

import type { Locale } from "@/lib/i18n/locales";
import { stringArrayElements } from "../ast-utils";
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
  type ParseDiagnostic,
  type ParsedColumn,
  type ParsedRelation,
  type ParsedSchema,
  type ParsedTable,
  type ParserFile,
} from "../types";
import { parseFailureMessage, validateSchema } from "../validate";

/**
 * MikroORM entity sınıflarını okur.
 *
 * TypeORM'den önemli bir farkı var: `@ManyToOne` ile işaretlenen alan **kendisi
 * yabancı anahtar kolonudur** (veritabanında `author_id` olarak tutulur), ayrı
 * bir id alanı yazılmaz. Bu yüzden burada ilişki alanı hem kolon hem ilişki
 * üretir.
 */

const TO_ONE = ["ManyToOne", "OneToOne"];
const TO_MANY = ["OneToMany", "ManyToMany"];

const TS_TYPE_MAP: Record<string, string> = {
  string: "varchar",
  number: "int",
  boolean: "boolean",
  Date: "datetime",
  object: "json",
};

export function parseMikroOrmSchema(files: ParserFile[], locale: Locale = "tr"): ParsedSchema {
  const usable = files.filter((file) => file.content.trim().length > 0);
  if (usable.length === 0) return emptySchema("mikroorm");

  const diagnostics: ParseDiagnostic[] = [];

  try {
    const { project, sourceFiles } = createTsProject(usable);
    diagnostics.push(...syntacticDiagnostics(project, sourceFiles));

    const entities = sourceFiles.flatMap((sourceFile) =>
      sourceFile.getClasses().filter((declaration) => hasDecorator(readDecorators(declaration), "Entity")),
    );
    const entityNames = new Set(entities.map((declaration) => declaration.getName() ?? ""));

    const tables: ParsedTable[] = [];
    const relations: ParsedRelation[] = [];

    for (const declaration of entities) {
      const parsed = parseEntity(declaration, entityNames);
      if (!parsed) continue;
      tables.push(parsed.table);
      relations.push(...parsed.relations);
    }

    const schema: ParsedSchema = {
      orm: "mikroorm",
      dialect: "unknown",
      tables,
      enums: [],
      relations,
      diagnostics,
    };

    validateSchema(schema, locale);
    return schema;
  } catch (error) {
    return {
      ...emptySchema("mikroorm"),
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

function parseEntity(
  declaration: ClassDeclaration,
  entityNames: Set<string>,
): { table: ParsedTable; relations: ParsedRelation[] } | undefined {
  const className = declaration.getName();
  if (!className) return undefined;

  const classDecorators = readDecorators(declaration);
  const table: ParsedTable = {
    id: className,
    name: entityTableName(findDecorator(classDecorators, "Entity"), className),
    dialect: "unknown",
    columns: [],
    indexes: [],
    compositePrimaryKey: [],
    line: declaration.getStartLineNumber(),
    file: declaration.getSourceFile().getBaseName(),
  };

  applyIndexDecorators(table, classDecorators);

  const relations: ParsedRelation[] = [];

  for (const property of declaration.getProperties()) {
    const name = property.getName();
    const decorators = readDecorators(property);
    const toOne = findDecorator(decorators, ...TO_ONE);
    const toMany = findDecorator(decorators, ...TO_MANY);
    const relationDecorator = toOne ?? toMany;

    if (relationDecorator) {
      const target =
        relationTarget(relationDecorator) ?? unwrapTypeText(propertyTypeText(property)).base;
      if (!target || !entityNames.has(target)) continue;

      relations.push({
        id: `${className}.${name}`,
        kind: toMany ? "many" : "one",
        sourceTable: className,
        fieldName: name,
        targetTable: target,
        fields: toOne ? [name] : [],
        references: toOne ? ["id"] : [],
        relationName: inverseFieldName(relationDecorator),
        line: property.getStartLineNumber(),
        file: table.file,
      });

      // `@ManyToOne`/`@OneToOne` alanı aynı zamanda yabancı anahtar kolonudur.
      if (toOne) {
        const options = relationDecorator.options;
        const onDelete = options.deleteRule ?? options.onDelete;

        table.columns.push({
          key: name,
          name: typeof options.fieldName === "string" ? options.fieldName : name,
          type: "reference",
          displayType: `→ ${target}`,
          isPrimaryKey: options.primary === true,
          isNotNull: options.nullable !== true,
          isUnique: options.unique === true || relationDecorator.name === "OneToOne",
          hasDefault: false,
          isArray: false,
          reference: {
            table: target,
            column: "id",
            onDelete: typeof onDelete === "string" ? onDelete.toLowerCase() : undefined,
            isComposite: false,
          },
        });

        if (hasDecorator(decorators, "Index")) {
          table.indexes.push({ columns: [name], isUnique: false });
        }
      }
      continue;
    }

    const column = parseColumn(name, decorators, propertyTypeText(property));
    if (!column) continue;

    table.columns.push(column);
    applyIndexDecorators(table, decorators, column.key);
  }

  const primaries = table.columns.filter((column) => column.isPrimaryKey);
  if (primaries.length > 1) {
    table.compositePrimaryKey = primaries.map((column) => column.key);
  }

  return { table, relations };
}

function parseColumn(
  name: string,
  decorators: ReadDecorator[],
  typeText: string,
): ParsedColumn | undefined {
  const primary = findDecorator(decorators, "PrimaryKey");
  const enumDecorator = findDecorator(decorators, "Enum");
  const property = findDecorator(decorators, "Property");
  const decorator = primary ?? enumDecorator ?? property;
  if (!decorator) return undefined;

  const options = decorator.options;
  const { base, isArray, isNullable } = unwrapTypeText(typeText);
  const explicitType = typeof options.type === "string" ? options.type : undefined;
  const type = explicitType ?? (enumDecorator ? "enum" : (TS_TYPE_MAP[base] ?? base));
  const length = typeof options.length === "number" ? options.length : undefined;

  const enumValues = optionStringArray(decorator, "items");

  return {
    key: name,
    name: typeof options.fieldName === "string" ? options.fieldName : name,
    type,
    displayType: `${length ? `${type}(${length})` : type}${isArray ? "[]" : ""}`,
    isPrimaryKey: Boolean(primary) || options.primary === true,
    isNotNull: !(options.nullable === true || isNullable),
    isUnique: options.unique === true,
    hasDefault: options.default !== undefined || options.defaultRaw !== undefined || Boolean(primary),
    defaultValue:
      options.default !== undefined
        ? String(options.default)
        : options.defaultRaw !== undefined
          ? String(options.defaultRaw)
          : primary
            ? "auto"
            : undefined,
    isArray,
    enumValues: enumValues.length > 0 ? enumValues : undefined,
  };
}

/**
 * `@Index({ properties: ['a', 'b'] })` sınıf üzerinde, `@Index()` ise alan
 * üzerinde kullanılır; ikisini de aynı yerden okuyoruz.
 */
function applyIndexDecorators(
  table: ParsedTable,
  decorators: ReadDecorator[],
  columnKey?: string,
): void {
  for (const decorator of decorators) {
    if (decorator.name !== "Index" && decorator.name !== "Unique") continue;

    const declared = optionStringArray(decorator, "properties");
    const columns =
      declared.length > 0
        ? declared
        : columnKey
          ? [columnKey]
          : stringArrayElements(decorator.args.find(Node.isArrayLiteralExpression));

    if (columns.length === 0) continue;

    table.indexes.push({
      name: typeof decorator.options.name === "string" ? decorator.options.name : undefined,
      columns,
      isUnique: decorator.name === "Unique",
    });
  }
}
