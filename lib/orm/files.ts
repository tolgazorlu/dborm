import { ORM_CATALOG, type EditorLanguage, type OrmFile } from "./catalog";
import type { OrmId } from "./types";

/** Extensions an imported schema file may carry. */
const ALLOWED_EXTENSIONS = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "prisma"];

const MAX_NAME_LENGTH = 120;
const MAX_SEGMENTS = 4;

/** Imported files beyond the ORM's own tabs, to keep the tab bar workable. */
export const MAX_IMPORTED_FILES = 20;

/**
 * Normalises a file name coming from a file picker or a drag-and-drop, and
 * rejects anything that is not a plausible schema file. The returned name is
 * both the tab label and the key the content is stored under, so it has to be
 * stable and free of path tricks.
 */
export function normalizeFileName(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

  if (cleaned.length === 0 || cleaned.length > MAX_NAME_LENGTH) return null;

  const segments = cleaned.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) return null;
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  if (segments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment))) return null;

  const name = segments.join("/");
  return ALLOWED_EXTENSIONS.includes(extensionOf(name)) ? name : null;
}

export function languageOf(fileName: string): EditorLanguage {
  return extensionOf(fileName) === "prisma" ? "prisma" : "typescript";
}

function extensionOf(fileName: string): string {
  const base = fileName.split("/").pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

export interface WorkspaceFile extends OrmFile {
  /** Imported files can be closed again; the ORM's own tabs cannot. */
  imported: boolean;
}

/**
 * The tabs for an ORM: its built-in files first, then every file the user
 * imported. Imported files are stored under their own name as the key.
 */
export function workspaceFiles(orm: OrmId, sources: Record<string, string>): WorkspaceFile[] {
  const builtIn = ORM_CATALOG[orm].files;
  const builtInKeys = new Set(builtIn.map((file) => file.key));

  const imported = Object.keys(sources)
    .filter((key) => !builtInKeys.has(key))
    .filter((key) => normalizeFileName(key) === key)
    .sort((a, b) => a.localeCompare(b))
    .map<WorkspaceFile>((key) => ({
      key,
      name: key,
      language: languageOf(key),
      imported: true,
    }));

  return [...builtIn.map((file) => ({ ...file, imported: false })), ...imported];
}

/** The path a stored source is parsed under: built-in tabs keep their file name. */
export function pathForKey(orm: OrmId, key: string): string | null {
  const builtIn = ORM_CATALOG[orm].files.find((file) => file.key === key);
  if (builtIn) return builtIn.name;
  return normalizeFileName(key);
}
