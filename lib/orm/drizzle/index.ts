import type { Locale } from "@/lib/i18n/locales";
import { createTsProject, syntacticDiagnostics } from "../ts-project";
import {
  emptySchema,
  type Dialect,
  type ParseDiagnostic,
  type ParsedEnum,
  type ParsedRelation,
  type ParsedSchema,
  type ParsedTable,
  type ParserFile,
} from "../types";
import { parseFailureMessage, validateSchema } from "../validate";
import { isRelationsDeclaration, parseRelationsDeclaration } from "./parse-relations";
import {
  isEnumDeclaration,
  isTableDeclaration,
  parseEnumDeclaration,
  parseTableDeclaration,
} from "./parse-tables";

/**
 * Drizzle ORM şema/ilişki kaynak kodunu AST üzerinden okuyup JSON'a çevirir.
 */
export function parseDrizzleSchema(files: ParserFile[], locale: Locale = "tr"): ParsedSchema {
  const usable = files.filter((file) => file.content.trim().length > 0);
  if (usable.length === 0) return emptySchema("drizzle");

  const diagnostics: ParseDiagnostic[] = [];

  try {
    const { project, sourceFiles } = createTsProject(usable);
    diagnostics.push(...syntacticDiagnostics(project, sourceFiles));

    // Enum'lar önce toplanır: kolon tipleri onlara referans veriyor.
    const enums = new Map<string, ParsedEnum>();
    for (const sourceFile of sourceFiles) {
      for (const declaration of sourceFile.getVariableDeclarations()) {
        if (!isEnumDeclaration(declaration)) continue;
        const parsed = parseEnumDeclaration(declaration);
        if (parsed) enums.set(parsed.id, parsed);
      }
    }

    const tables: ParsedTable[] = [];
    const relations: ParsedRelation[] = [];

    for (const sourceFile of sourceFiles) {
      for (const declaration of sourceFile.getVariableDeclarations()) {
        if (isTableDeclaration(declaration)) {
          const table = parseTableDeclaration(declaration, enums);
          if (table) tables.push(table);
        } else if (isRelationsDeclaration(declaration)) {
          relations.push(...parseRelationsDeclaration(declaration));
        }
      }
    }

    const schema: ParsedSchema = {
      orm: "drizzle",
      dialect: resolveDialect(tables, enums),
      tables,
      enums: [...enums.values()],
      relations,
      diagnostics,
    };

    validateSchema(schema, locale);
    return schema;
  } catch (error) {
    return {
      ...emptySchema("drizzle"),
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

function resolveDialect(tables: ParsedTable[], enums: Map<string, ParsedEnum>): Dialect {
  const first = tables.find((table) => table.dialect !== "unknown");
  if (first) return first.dialect;
  return enums.size > 0 ? "pg" : "unknown";
}
