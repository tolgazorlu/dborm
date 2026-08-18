import { ORM_SAMPLES } from "./samples";
import { ORM_IDS, type OrmId } from "./types";

export type EditorLanguage = "typescript" | "prisma";

export interface OrmFile {
  key: string;
  name: string;
  language: EditorLanguage;
}

export interface OrmDescriptor {
  id: OrmId;
  label: string;
  files: OrmFile[];
  sample: Record<string, string>;
}

export const ORM_CATALOG: Record<OrmId, OrmDescriptor> = {
  drizzle: {
    id: "drizzle",
    label: "Drizzle",
    files: [
      { key: "schema", name: "schema.ts", language: "typescript" },
      { key: "relations", name: "relations.ts", language: "typescript" },
    ],
    sample: ORM_SAMPLES.drizzle,
  },
  prisma: {
    id: "prisma",
    label: "Prisma",
    files: [{ key: "schema", name: "schema.prisma", language: "prisma" }],
    sample: ORM_SAMPLES.prisma,
  },
  typeorm: {
    id: "typeorm",
    label: "TypeORM",
    files: [{ key: "schema", name: "entities.ts", language: "typescript" }],
    sample: ORM_SAMPLES.typeorm,
  },
  mikroorm: {
    id: "mikroorm",
    label: "MikroORM",
    files: [{ key: "schema", name: "entities.ts", language: "typescript" }],
    sample: ORM_SAMPLES.mikroorm,
  },
  sequelize: {
    id: "sequelize",
    label: "Sequelize",
    files: [{ key: "schema", name: "models.ts", language: "typescript" }],
    sample: ORM_SAMPLES.sequelize,
  },
  kysely: {
    id: "kysely",
    label: "Kysely",
    files: [{ key: "schema", name: "database.ts", language: "typescript" }],
    sample: ORM_SAMPLES.kysely,
  },
  mongoose: {
    id: "mongoose",
    label: "Mongoose",
    files: [{ key: "schema", name: "models.ts", language: "typescript" }],
    sample: ORM_SAMPLES.mongoose,
  },
};

export const ORM_LIST: OrmDescriptor[] = ORM_IDS.map((id) => ORM_CATALOG[id]);

export function isOrmId(value: unknown): value is OrmId {
  return typeof value === "string" && (ORM_IDS as readonly string[]).includes(value);
}

export function toOrmId(value: unknown): OrmId {
  return isOrmId(value) ? value : "drizzle";
}

export function initialSources(): Record<OrmId, Record<string, string>> {
  return Object.fromEntries(
    ORM_IDS.map((id) => [id, { ...ORM_CATALOG[id].sample }]),
  ) as Record<OrmId, Record<string, string>>;
}
