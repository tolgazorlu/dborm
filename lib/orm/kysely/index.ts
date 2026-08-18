import type { InterfaceDeclaration, SourceFile } from "ts-morph";

import type { Locale } from "@/lib/i18n/locales";
import { unwrapTypeText } from "../decorators";
import { createTsProject, syntacticDiagnostics } from "../ts-project";
import {
  emptySchema,
  type ParseDiagnostic,
  type ParsedColumn,
  type ParsedSchema,
  type ParsedTable,
  type ParserFile,
} from "../types";
import { parseFailureMessage, validateSchema } from "../validate";

const TYPE_MAP: Record<string, string> = {
  string: "text",
  number: "numeric",
  boolean: "boolean",
  Date: "timestamp",
  bigint: "bigint",
  Buffer: "bytea",
};

export function parseKyselySchema(files: ParserFile[], locale: Locale = "tr"): ParsedSchema {
  const usable = files.filter((file) => file.content.trim().length > 0);
  if (usable.length === 0) return emptySchema("kysely");

  const diagnostics: ParseDiagnostic[] = [];

  try {
    const { project, sourceFiles } = createTsProject(usable);
    diagnostics.push(...syntacticDiagnostics(project, sourceFiles));

    const interfaces = sourceFiles.flatMap((sourceFile) => sourceFile.getInterfaces());
    const databaseMap = findDatabaseMap(sourceFiles);

    const tables: ParsedTable[] = [];
    for (const declaration of interfaces) {
      const name = declaration.getName();
      if (databaseMap.registry === name) continue;

      const tableName = databaseMap.byInterface.get(name);
      if (databaseMap.registry && !tableName) continue;

      tables.push(parseTableInterface(declaration, tableName ?? name));
    }

    inferReferences(tables);

    const schema: ParsedSchema = {
      orm: "kysely",
      dialect: "unknown",
      tables,
      enums: [],
      relations: [],
      diagnostics,
    };

    validateSchema(schema, locale);
    return schema;
  } catch (error) {
    return {
      ...emptySchema("kysely"),
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

function findDatabaseMap(sourceFiles: SourceFile[]): {
  registry?: string;
  byInterface: Map<string, string>;
} {
  const byInterface = new Map<string, string>();

  for (const sourceFile of sourceFiles) {
    for (const declaration of sourceFile.getInterfaces()) {
      const members = declaration.getProperties();
      if (members.length === 0) continue;

      const targets = members.map((member) => member.getTypeNode()?.getText() ?? "");
      const interfaceNames = new Set(
        sourceFiles.flatMap((file) => file.getInterfaces().map((item) => item.getName())),
      );
      const isRegistry =
        targets.length > 0 && targets.every((target) => interfaceNames.has(target.trim()));

      if (!isRegistry) continue;

      for (const member of members) {
        const target = member.getTypeNode()?.getText().trim();
        if (target) byInterface.set(target, unquote(member.getName()));
      }
      return { registry: declaration.getName(), byInterface };
    }
  }

  return { byInterface };
}

function parseTableInterface(declaration: InterfaceDeclaration, tableName: string): ParsedTable {
  const table: ParsedTable = {
    id: declaration.getName(),
    name: tableName,
    dialect: "unknown",
    columns: [],
    indexes: [],
    compositePrimaryKey: [],
    line: declaration.getStartLineNumber(),
    file: declaration.getSourceFile().getBaseName(),
  };

  for (const member of declaration.getProperties()) {
    const key = unquote(member.getName());
    const typeText = member.getTypeNode()?.getText() ?? "unknown";
    table.columns.push(parseColumn(key, typeText, member.hasQuestionToken()));
  }

  return table;
}

function parseColumn(key: string, typeText: string, isOptional: boolean): ParsedColumn {
  const generated = /^Generated<\s*([\s\S]+)\s*>$/.exec(typeText.trim());
  const columnType = /^ColumnType<\s*([^,>]+)/.exec(typeText.trim());

  const inner = generated?.[1] ?? columnType?.[1] ?? typeText;
  const { base, isArray, isNullable } = unwrapTypeText(inner);

  return {
    key,
    name: key,
    type: TYPE_MAP[base] ?? base,
    displayType: `${TYPE_MAP[base] ?? base}${isArray ? "[]" : ""}`,
    isPrimaryKey: Boolean(generated) && key === "id",
    isNotNull: !isNullable && !isOptional,
    isUnique: false,
    hasDefault: Boolean(generated) || isOptional,
    defaultValue: generated ? "generated" : undefined,
    isArray,
  };
}

function inferReferences(tables: ParsedTable[]): void {
  const byNormalizedName = new Map<string, ParsedTable>();
  for (const table of tables) {
    byNormalizedName.set(normalize(table.name), table);
    byNormalizedName.set(normalize(table.id), table);
  }

  for (const table of tables) {
    for (const column of table.columns) {
      if (column.reference || column.isPrimaryKey) continue;

      const match = /^(.*?)(_id|Id)$/.exec(column.key);
      if (!match || !match[1]) continue;

      const target = byNormalizedName.get(normalize(match[1]));
      if (!target || target.id === table.id) continue;
      if (!target.columns.some((item) => item.key === "id")) continue;

      column.reference = { table: target.id, column: "id", isComposite: false, isInferred: true };
    }
  }
}

function normalize(value: string): string {
  return value
    .replace(/Table$/, "")
    .replace(/[_-]/g, "")
    .toLowerCase()
    .replace(/ies$/, "y")
    .replace(/s$/, "");
}

function unquote(value: string): string {
  return value.replace(/^["'`]|["'`]$/g, "");
}
