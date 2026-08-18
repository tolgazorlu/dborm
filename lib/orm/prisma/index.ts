import type { Locale } from "@/lib/i18n/locales";
import {
  emptySchema,
  type Dialect,
  type ParseDiagnostic,
  type ParsedColumn,
  type ParsedEnum,
  type ParsedRelation,
  type ParsedSchema,
  type ParsedTable,
  type ParserFile,
} from "../types";
import { parseFailureMessage, validateSchema } from "../validate";

const PROVIDER_DIALECTS: Record<string, Dialect> = {
  postgresql: "pg",
  postgres: "pg",
  cockroachdb: "pg",
  mysql: "mysql",
  sqlite: "sqlite",
  sqlserver: "sqlserver",
  mongodb: "mongo",
};

const REFERENTIAL_ACTIONS: Record<string, string> = {
  Cascade: "cascade",
  SetNull: "set null",
  SetDefault: "set default",
  Restrict: "restrict",
  NoAction: "no action",
};

interface Block {
  kind: string;
  name: string;
  lines: { text: string; line: number }[];
  line: number;
}

interface Attribute {
  name: string;
  args: string;
}

export function parsePrismaSchema(files: ParserFile[], locale: Locale = "tr"): ParsedSchema {
  const usable = files.filter((file) => file.content.trim().length > 0);
  if (usable.length === 0) return emptySchema("prisma");

  const diagnostics: ParseDiagnostic[] = [];

  try {
    const blocks: { block: Block; file: string }[] = [];
    let dialect: Dialect = "unknown";

    for (const file of usable) {
      const fileName = file.path.split("/").pop() ?? file.path;
      const { blocks: parsed, unterminated } = readBlocks(file.content);

      if (unterminated) {
        diagnostics.push({
          level: "error",
          message:
            locale === "en"
              ? `Block \`${unterminated.kind} ${unterminated.name}\` is never closed.`
              : `\`${unterminated.kind} ${unterminated.name}\` bloğu kapatılmamış.`,
          file: fileName,
          line: unterminated.line,
        });
      }

      for (const block of parsed) {
        if (block.kind === "datasource") {
          const provider = /provider\s*=\s*"([^"]+)"/.exec(
            block.lines.map((item) => item.text).join("\n"),
          )?.[1];
          if (provider && PROVIDER_DIALECTS[provider]) dialect = PROVIDER_DIALECTS[provider];
          continue;
        }
        blocks.push({ block, file: fileName });
      }
    }

    const enums = new Map<string, ParsedEnum>();
    for (const { block } of blocks) {
      if (block.kind !== "enum") continue;
      enums.set(block.name, {
        id: block.name,
        name: block.name,
        values: block.lines
          .map((item) => item.text.trim())
          .filter((text) => /^[A-Za-z_]\w*$/.test(text)),
      });
    }

    const modelBlocks = blocks.filter(({ block }) => block.kind === "model" || block.kind === "view");
    const modelNames = new Set(modelBlocks.map(({ block }) => block.name));

    const tables: ParsedTable[] = [];
    const relations: ParsedRelation[] = [];

    for (const { block, file } of modelBlocks) {
      const { table, relations: modelRelations } = parseModel(block, file, dialect, modelNames, enums);
      tables.push(table);
      relations.push(...modelRelations);
    }

    const schema: ParsedSchema = {
      orm: "prisma",
      dialect,
      tables,
      enums: [...enums.values()],
      relations,
      diagnostics,
    };

    validateSchema(schema, locale);
    return schema;
  } catch (error) {
    return {
      ...emptySchema("prisma"),
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

function readBlocks(source: string): { blocks: Block[]; unterminated?: Block } {
  const lines = source.split(/\r?\n/);
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = stripComment(lines[index]);
    const text = raw.trim();
    if (text.length === 0) continue;

    if (current) {
      if (text === "}") {
        blocks.push(current);
        current = null;
      } else {
        current.lines.push({ text, line: index + 1 });
      }
      continue;
    }

    const header = /^(model|enum|datasource|generator|type|view)\s+([A-Za-z_]\w*)\s*\{?$/.exec(text);
    if (header) {
      current = { kind: header[1], name: header[2], lines: [], line: index + 1 };
    }
  }

  return current ? { blocks, unterminated: current } : { blocks };
}

function stripComment(line: string): string {
  let inString = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') inString = !inString;
    else if (!inString && char === "/" && line[index + 1] === "/") return line.slice(0, index);
  }
  return line;
}

function parseModel(
  block: Block,
  file: string,
  dialect: Dialect,
  modelNames: Set<string>,
  enums: Map<string, ParsedEnum>,
): { table: ParsedTable; relations: ParsedRelation[] } {
  const table: ParsedTable = {
    id: block.name,
    name: block.name,
    dialect,
    columns: [],
    indexes: [],
    compositePrimaryKey: [],
    line: block.line,
    file,
  };

  const relations: ParsedRelation[] = [];
  const pendingReferences: { column: string; table: string; column2: string; onDelete?: string; onUpdate?: string }[] =
    [];

  for (const { text, line } of block.lines) {
    if (text.startsWith("@@")) {
      applyBlockAttribute(table, text);
      continue;
    }

    const field = /^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)(\[\])?(\?)?\s*(.*)$/.exec(text);
    if (!field) continue;

    const [, fieldName, fieldType, listMarker, optionalMarker, rest] = field;
    const attributes = parseAttributes(rest);
    const isList = Boolean(listMarker);

    if (modelNames.has(fieldType)) {
      const relation = parseRelationAttribute(attributes);
      relations.push({
        id: `${block.name}.${fieldName}`,
        kind: isList ? "many" : "one",
        sourceTable: block.name,
        fieldName,
        targetTable: fieldType,
        fields: relation.fields,
        references: relation.references,
        relationName: relation.name,
        line,
        file,
      });

      relation.fields.forEach((column, index) => {
        pendingReferences.push({
          column,
          table: fieldType,
          column2: relation.references[index] ?? relation.references[0] ?? "id",
          onDelete: relation.onDelete,
          onUpdate: relation.onUpdate,
        });
      });
      continue;
    }

    table.columns.push(
      buildColumn(fieldName, fieldType, isList, Boolean(optionalMarker), attributes, enums),
    );
  }

  for (const pending of pendingReferences) {
    const column = table.columns.find((item) => item.key === pending.column);
    if (!column || column.reference) continue;
    column.reference = {
      table: pending.table,
      column: pending.column2,
      onDelete: pending.onDelete,
      onUpdate: pending.onUpdate,
      isComposite: true,
    };
  }

  return { table, relations };
}

function buildColumn(
  fieldName: string,
  fieldType: string,
  isList: boolean,
  isOptional: boolean,
  attributes: Attribute[],
  enums: Map<string, ParsedEnum>,
): ParsedColumn {
  const attribute = (name: string) => attributes.find((item) => item.name === name);
  const nativeType = attributes.find((item) => item.name.startsWith("db."));
  const enumDefinition = enums.get(fieldType);
  const defaultAttribute = attribute("default");

  const base = nativeType
    ? `${nativeType.name.slice(3)}${nativeType.args ? `(${nativeType.args})` : ""}`
    : enumDefinition
      ? `enum(${enumDefinition.name})`
      : fieldType;

  return {
    key: fieldName,
    name: unquote(attribute("map")?.args) ?? fieldName,
    type: fieldType,
    displayType: isList ? `${base}[]` : base,
    isPrimaryKey: Boolean(attribute("id")),
    isNotNull: !isOptional,
    isUnique: Boolean(attribute("unique")),
    hasDefault: Boolean(defaultAttribute) || Boolean(attribute("updatedAt")),
    defaultValue: defaultAttribute?.args || (attribute("updatedAt") ? "updatedAt" : undefined),
    isArray: isList,
    enumName: enumDefinition?.id,
    enumValues: enumDefinition?.values,
  };
}

function applyBlockAttribute(table: ParsedTable, text: string): void {
  const match = /^@@([A-Za-z_]\w*)\s*(?:\((.*)\))?$/.exec(text);
  if (!match) return;

  const [, name, args = ""] = match;

  switch (name) {
    case "map": {
      const mapped = unquote(args);
      if (mapped) table.name = mapped;
      break;
    }
    case "id":
      table.compositePrimaryKey = listArgument(args);
      break;
    case "unique":
      table.indexes.push({ name: namedArgument(args), columns: listArgument(args), isUnique: true });
      break;
    case "index":
      table.indexes.push({ name: namedArgument(args), columns: listArgument(args), isUnique: false });
      break;
    default:
      break;
  }
}

function parseAttributes(text: string): Attribute[] {
  const attributes: Attribute[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "@") continue;

    let cursor = index + 1;
    let name = "";
    while (cursor < text.length && /[\w.]/.test(text[cursor])) {
      name += text[cursor];
      cursor += 1;
    }
    if (!name) continue;

    let args = "";
    if (text[cursor] === "(") {
      let depth = 0;
      const start = cursor + 1;
      while (cursor < text.length) {
        if (text[cursor] === "(") depth += 1;
        else if (text[cursor] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
        cursor += 1;
      }
      args = text.slice(start, cursor);
    }

    attributes.push({ name, args });
    index = cursor;
  }

  return attributes;
}

function parseRelationAttribute(attributes: Attribute[]): {
  fields: string[];
  references: string[];
  onDelete?: string;
  onUpdate?: string;
  name?: string;
} {
  const relation = attributes.find((item) => item.name === "relation");
  if (!relation) return { fields: [], references: [] };

  const args = relation.args;
  const onDelete = /onDelete:\s*(\w+)/.exec(args)?.[1];
  const onUpdate = /onUpdate:\s*(\w+)/.exec(args)?.[1];

  return {
    fields: namedList(args, "fields"),
    references: namedList(args, "references"),
    onDelete: onDelete ? (REFERENTIAL_ACTIONS[onDelete] ?? onDelete.toLowerCase()) : undefined,
    onUpdate: onUpdate ? (REFERENTIAL_ACTIONS[onUpdate] ?? onUpdate.toLowerCase()) : undefined,
    name: unquote(/(?:name:\s*)?"([^"]*)"/.exec(args)?.[0]),
  };
}

function namedList(args: string, key: string): string[] {
  const match = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(args);
  return match ? splitList(match[1]) : [];
}

function listArgument(args: string): string[] {
  const match = /\[([^\]]*)\]/.exec(args);
  return match ? splitList(match[1]) : [];
}

function namedArgument(args: string): string | undefined {
  return unquote(/(?:name|map):\s*"([^"]*)"/.exec(args)?.[0]);
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().replace(/\(.*$/, "").trim())
    .filter(Boolean);
}

function unquote(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /"([^"]*)"/.exec(value);
  return match ? match[1] : undefined;
}
