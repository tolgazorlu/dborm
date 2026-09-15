import type { Locale } from "@/lib/i18n/locales";
import { parseDrizzleSchema } from "./drizzle";
import { pathForKey } from "./files";
import { parseKyselySchema } from "./kysely";
import { parseMikroOrmSchema } from "./mikroorm";
import { parseMongooseSchema } from "./mongoose";
import { parsePrismaSchema } from "./prisma";
import { parseSequelizeSchema } from "./sequelize";
import { parseTypeOrmSchema } from "./typeorm";
import type { OrmId, ParsedSchema, ParserFile } from "./types";

const PARSERS: Record<OrmId, (files: ParserFile[], locale: Locale) => ParsedSchema> = {
  drizzle: parseDrizzleSchema,
  prisma: parsePrismaSchema,
  typeorm: parseTypeOrmSchema,
  mikroorm: parseMikroOrmSchema,
  sequelize: parseSequelizeSchema,
  kysely: parseKyselySchema,
  mongoose: parseMongooseSchema,
};

export function parseSchema(orm: OrmId, files: ParserFile[], locale: Locale): ParsedSchema {
  return PARSERS[orm](files, locale);
}

/**
 * Turns stored sources into files for the parsers: the ORM's own tabs keep
 * their file name, and every imported file is parsed under the name it was
 * imported with, so `schemas/user.ts` stays `schemas/user.ts` in diagnostics.
 */
export function toParserFiles(orm: OrmId, sources: Record<string, unknown>): ParserFile[] {
  const files: ParserFile[] = [];
  const seen = new Set<string>();

  for (const [key, content] of Object.entries(sources)) {
    if (typeof content !== "string" || content.trim().length === 0) continue;

    const path = pathForKey(orm, key);
    if (!path || seen.has(path)) continue;

    seen.add(path);
    files.push({ path, content });
  }

  return files;
}
