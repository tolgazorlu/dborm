import type { Locale } from "@/lib/i18n/locales";
import { ORM_IDS, type OrmId, type ParseDiagnostic, type ParsedSchema, type ParserFile } from "./types";

/**
 * Markers that identify which ORM a file was written for, split by what they
 * prove. `identity` patterns — imports, connection blocks — only say which ORM
 * the file belongs to; `declarations` are the ones that promise an entity, so
 * only those may claim a file should have produced a table.
 *
 * They are matched against the file with comments stripped, so commented-out
 * code never decides the outcome.
 */
interface OrmSignature {
  identity: RegExp[];
  declarations: RegExp[];
}

const SIGNATURES: Record<OrmId, OrmSignature> = {
  drizzle: {
    identity: [/from\s*['"]drizzle-orm/],
    declarations: [
      /\b(?:pg|mysql|sqlite)Table\s*\(/,
      /\b(?:pg|mysql|sqlite)TableCreator\s*\(/,
      /\b(?:pg|mysql)Schema\s*\(/,
      /\brelations\s*\(\s*\w+\s*,/,
    ],
  },
  prisma: {
    // A `schema.prisma` that only wires up the connection is a normal split
    // setup, not a file whose models failed to parse.
    identity: [/^[ \t]*datasource\s+\w+\s*\{/m, /^[ \t]*generator\s+\w+\s*\{/m, /^[ \t]*enum\s+\w+\s*\{/m],
    declarations: [/^[ \t]*model\s+\w+\s*\{/m, /^[ \t]*view\s+\w+\s*\{/m],
  },
  typeorm: {
    identity: [/from\s*['"]typeorm['"]/],
    declarations: [/@(?:Entity|PrimaryGeneratedColumn)\s*\(/],
  },
  mikroorm: {
    identity: [/from\s*['"]@mikro-orm\//],
    declarations: [/@(?:Entity|PrimaryKey)\s*\(/],
  },
  sequelize: {
    identity: [/from\s*['"]sequelize/],
    declarations: [/\.define\s*\(\s*['"]/, /extends\s+Model\b/],
  },
  kysely: {
    identity: [/from\s*['"]kysely['"]/],
    declarations: [/\bGenerated<|\bColumnType</],
  },
  mongoose: {
    identity: [/from\s*['"]mongoose['"]/],
    declarations: [/new\s+(?:mongoose\.)?Schema\s*\(/],
  },
};

const ORM_LABELS: Record<OrmId, string> = {
  drizzle: "Drizzle",
  prisma: "Prisma",
  typeorm: "TypeORM",
  mikroorm: "MikroORM",
  sequelize: "Sequelize",
  kysely: "Kysely",
  mongoose: "Mongoose",
};

/** What each parser is looking for, phrased for the person who pasted the file. */
const EXPECTATIONS: Record<Locale, Record<OrmId, string>> = {
  tr: {
    drizzle: "`pgTable(...)`, `mysqlTable(...)`, `sqliteTable(...)`, `pgSchema(...).table(...)` ya da `pgTableCreator(...)` ile tanımlanmış bir tablo",
    prisma: "`model Ad { ... }` bloğu",
    typeorm: "`@Entity()` ile işaretlenmiş bir sınıf",
    mikroorm: "`@Entity()` ile işaretlenmiş bir sınıf",
    sequelize: "`sequelize.define(...)` çağrısı ya da `Model.init(...)` kullanan bir sınıf",
    kysely: "tablo satırını tanımlayan bir `interface`",
    mongoose: "`new Schema({ ... })` çağrısı",
  },
  en: {
    drizzle: "a table declared with `pgTable(...)`, `mysqlTable(...)`, `sqliteTable(...)`, `pgSchema(...).table(...)` or `pgTableCreator(...)`",
    prisma: "a `model Name { ... }` block",
    typeorm: "a class marked with `@Entity()`",
    mikroorm: "a class marked with `@Entity()`",
    sequelize: "a `sequelize.define(...)` call or a class using `Model.init(...)`",
    kysely: "an `interface` describing a table row",
    mongoose: "a `new Schema({ ... })` call",
  },
};

const MESSAGES = {
  tr: {
    nothingRecognized: (file: string, orm: string, expectation: string) =>
      `\`${file}\` içinde ${orm} tablosu bulunamadı. Ayrıştırıcı ${expectation} arıyor.`,
    partlyUnread: (file: string, orm: string, expectation: string) =>
      `\`${file}\` ${orm} tanımı içeriyor gibi görünüyor ama okunabilen tablo çıkmadı. Ayrıştırıcı ${expectation} arıyor.`,
    wrongOrm: (file: string, detected: string, selected: string) =>
      `\`${file}\` bir ${detected} şemasına benziyor ama seçili ORM ${selected}. Üstteki ORM seçicisini ${detected} yapın.`,
  },
  en: {
    nothingRecognized: (file: string, orm: string, expectation: string) =>
      `No ${orm} table found in \`${file}\`. The parser looks for ${expectation}.`,
    partlyUnread: (file: string, orm: string, expectation: string) =>
      `\`${file}\` looks like it holds ${orm} definitions, but no readable table came out of it. The parser looks for ${expectation}.`,
    wrongOrm: (file: string, detected: string, selected: string) =>
      `\`${file}\` looks like a ${detected} schema, but the selected ORM is ${selected}. Switch the ORM selector to ${detected}.`,
  },
} satisfies Record<Locale, unknown>;

/**
 * Explains every file that produced nothing, so an unsupported or
 * mis-selected schema surfaces as a located message instead of an empty
 * canvas. Called by each parser once its tables are collected; appends to
 * `schema.diagnostics` and drops syntax noise from files that turn out to
 * belong to a different ORM.
 *
 * `alsoProduced` lists files that contributed something other than a table —
 * a Prisma `datasource`, say — and so must not be reported as unread.
 */
export function applyRecognition(
  schema: ParsedSchema,
  files: ParserFile[],
  locale: Locale,
  alsoProduced: Iterable<string> = [],
): void {
  const messages = MESSAGES[locale] ?? MESSAGES.tr;
  const ormLabel = ORM_LABELS[schema.orm];
  const expectation = EXPECTATIONS[locale][schema.orm];

  // Files are tracked by their full parser path: two imported files can share
  // a basename (`schemas/user.ts` and `admin/user.ts`), and treating those as
  // one would hide the diagnostic for the second.
  const producedFiles = new Set<string>([
    ...schema.tables.map((table) => table.file),
    ...schema.relations.map((relation) => relation.file),
    ...alsoProduced,
  ]);
  const filesWithErrors = new Set(
    schema.diagnostics
      .filter((diagnostic) => diagnostic.level === "error" && diagnostic.file)
      .map((diagnostic) => diagnostic.file as string),
  );

  const diagnostics: ParseDiagnostic[] = [];
  const foreignFiles = new Set<string>();

  for (const file of files) {
    const name = file.path;
    if (producedFiles.has(name)) continue;

    const body = stripComments(file.content);
    if (body.trim().length === 0) continue;

    const detected = detectOrm(body, schema.orm);
    const anchor = firstMeaningfulLine(file.content);

    if (detected) {
      // The TypeScript syntax errors from another ORM's syntax are noise next
      // to "this is a Prisma schema"; keep only the useful message.
      foreignFiles.add(name);
      diagnostics.push({
        level: "error",
        message: messages.wrongOrm(name, ORM_LABELS[detected], ormLabel),
        file: name,
        line: anchor,
      });
      continue;
    }

    // A syntax error was already reported for this file with its own location.
    if (filesWithErrors.has(name)) continue;

    if (schema.tables.length === 0) {
      diagnostics.push({
        level: "error",
        message: messages.nothingRecognized(name, ormLabel, expectation),
        file: name,
        line: anchor,
      });
    } else if (SIGNATURES[schema.orm].declarations.some((pattern) => pattern.test(body))) {
      // Other files worked, so this one is a supporting file unless it clearly
      // tried to declare something.
      diagnostics.push({
        level: "warning",
        message: messages.partlyUnread(name, ormLabel, expectation),
        file: name,
        line: anchor,
      });
    }
  }

  if (foreignFiles.size > 0) {
    const kept = schema.diagnostics.filter(
      (diagnostic) => !(diagnostic.file && foreignFiles.has(diagnostic.file)),
    );
    schema.diagnostics.length = 0;
    schema.diagnostics.push(...kept);
  }

  schema.diagnostics.push(...diagnostics);
}

/** The ORM a file was written for, when it is clearly not the selected one. */
function detectOrm(body: string, selected: OrmId): OrmId | undefined {
  const score = (orm: OrmId) =>
    [...SIGNATURES[orm].identity, ...SIGNATURES[orm].declarations].filter((pattern) =>
      pattern.test(body),
    ).length;

  if (score(selected) > 0) return undefined;

  let best: { orm: OrmId; score: number } | undefined;
  for (const orm of ORM_IDS) {
    const value = score(orm);
    if (value > 0 && (!best || value > best.score)) best = { orm, score: value };
  }

  return best?.orm;
}

/**
 * The first line that carries code: blank lines, comments and imports are
 * skipped so the reported position is where a definition was expected.
 */
function firstMeaningfulLine(content: string): number | undefined {
  const lines = stripComments(content).split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim();
    if (text.length === 0) continue;
    if (/^(?:import|export\s+(?:\*|\{)|const\s*\{)/.test(text) && /from\s*['"]/.test(text)) continue;
    if (/^(?:require|#)/.test(text)) continue;
    return index + 1;
  }

  return undefined;
}

/**
 * Blanks out line and block comments while keeping every line break, so line
 * numbers stay true and commented-out code never counts as a definition.
 * String literals are respected so that `"// not a comment"` survives.
 */
export function stripComments(content: string): string {
  let result = "";
  let index = 0;
  let quote: string | null = null;

  while (index < content.length) {
    const char = content[index];
    const next = content[index + 1];

    if (quote) {
      if (char === "\\") {
        result += content.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      result += char;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      result += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < content.length && content[index] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) {
        if (content[index] === "\n") result += "\n";
        index += 1;
      }
      index += 2;
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}
