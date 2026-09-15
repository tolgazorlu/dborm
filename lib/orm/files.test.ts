import assert from "node:assert/strict";
import { test } from "node:test";

import { languageOf, normalizeFileName, pathForKey, workspaceFiles } from "./files";
import { toParserFiles } from "./parse";

test("accepts plausible schema file names", () => {
  assert.equal(normalizeFileName("user.ts"), "user.ts");
  assert.equal(normalizeFileName("schemas/user.ts"), "schemas/user.ts");
  assert.equal(normalizeFileName("./src/db/schema.prisma"), "src/db/schema.prisma");
  assert.equal(normalizeFileName("C:\\app\\schema.ts"), null);
});

test("rejects path tricks, unknown extensions and oversized names", () => {
  assert.equal(normalizeFileName("../../etc/passwd"), null);
  assert.equal(normalizeFileName("/etc/passwd"), null);
  assert.equal(normalizeFileName("schema.sql"), null);
  assert.equal(normalizeFileName("schema"), null);
  assert.equal(normalizeFileName("a/b/c/d/e/schema.ts"), null);
  assert.equal(normalizeFileName(`${"x".repeat(200)}.ts`), null);
});

test("picks the editor language from the extension", () => {
  assert.equal(languageOf("schemas/user.ts"), "typescript");
  assert.equal(languageOf("schema.prisma"), "prisma");
});

test("built-in tabs come first, imported files follow in name order", () => {
  const files = workspaceFiles("drizzle", {
    schema: "a",
    relations: "b",
    "schemas/user.ts": "c",
    "product.ts": "d",
    "../evil.ts": "e",
  });

  assert.deepEqual(
    files.map((file) => file.name),
    ["schema.ts", "relations.ts", "product.ts", "schemas/user.ts"],
  );
  assert.deepEqual(
    files.map((file) => file.imported),
    [false, false, true, true],
  );
});

test("imported files are parsed under their own name", () => {
  assert.equal(pathForKey("drizzle", "schema"), "schema.ts");
  assert.equal(pathForKey("drizzle", "schemas/user.ts"), "schemas/user.ts");
  assert.equal(pathForKey("drizzle", "../evil.ts"), null);

  const files = toParserFiles("drizzle", {
    schema: "export const a = 1;",
    "schemas/user.ts": "export const b = 2;",
    "../evil.ts": "export const c = 3;",
    relations: "   ",
  });

  assert.deepEqual(
    files.map((file) => file.path),
    ["schema.ts", "schemas/user.ts"],
  );
});
