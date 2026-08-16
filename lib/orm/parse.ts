import type { Locale } from "@/lib/i18n/locales";
import { ORM_CATALOG } from "./catalog";
import { parseDrizzleSchema } from "./drizzle";
import { parseKyselySchema } from "./kysely";
import { parseMikroOrmSchema } from "./mikroorm";
import { parseMongooseSchema } from "./mongoose";
import { parsePrismaSchema } from "./prisma";
import { parseSequelizeSchema } from "./sequelize";
import { parseTypeOrmSchema } from "./typeorm";
import type { OrmId, ParsedSchema, ParserFile } from "./types";

/**
 * Sunucu tarafı dağıtıcı. Yalnızca route handler'lardan import edilmeli:
 * buradan ts-morph ve TypeScript derleyicisi zincire giriyor.
 */
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
 * İstek gövdesindeki `{ schema: "...", relations: "..." }` sözlüğünü, ilgili
 * ORM'in dosya tanımına göre parser girdisine çevirir. Tanımlı olmayan
 * anahtarlar yok sayılır.
 */
export function toParserFiles(orm: OrmId, sources: Record<string, unknown>): ParserFile[] {
  return ORM_CATALOG[orm].files
    .map((file) => ({ path: file.name, content: sources[file.key] }))
    .filter((file): file is ParserFile => typeof file.content === "string")
    .filter((file) => file.content.trim().length > 0);
}
