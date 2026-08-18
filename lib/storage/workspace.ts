import { ORM_CATALOG, isOrmId } from "@/lib/orm/catalog";
import { ORM_IDS, type OrmId } from "@/lib/orm/types";

const STORAGE_KEY = "ormlens:workspace:v1";

const MAX_STORED_BYTES = 256 * 1024;

export interface StoredWorkspace {
  orm: OrmId;
  sources: Record<OrmId, Record<string, string>>;
}

export function readWorkspace(): StoredWorkspace | null {
  if (typeof window === "undefined") return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    return sanitize(JSON.parse(raw));
  } catch {
    clearWorkspace();
    return null;
  }
}

export function writeWorkspace(value: StoredWorkspace): void {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_STORED_BYTES) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {}
}

export function clearWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function sanitize(value: unknown): StoredWorkspace | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const rawSources = record.sources;
  if (typeof rawSources !== "object" || rawSources === null) return null;

  const sources = {} as Record<OrmId, Record<string, string>>;
  let hasContent = false;

  for (const orm of ORM_IDS) {
    const stored = (rawSources as Record<string, unknown>)[orm];
    const files: Record<string, string> = {};

    if (typeof stored === "object" && stored !== null) {
      for (const file of ORM_CATALOG[orm].files) {
        const content = (stored as Record<string, unknown>)[file.key];
        if (typeof content === "string") {
          files[file.key] = content;
          hasContent = true;
        }
      }
    }
    sources[orm] = files;
  }

  if (!hasContent) return null;

  return { orm: isOrmId(record.orm) ? record.orm : ORM_IDS[0], sources };
}
