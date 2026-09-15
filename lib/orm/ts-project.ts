import { Project, ScriptTarget, ts, type SourceFile } from "ts-morph";

import type { ParseDiagnostic, ParserFile } from "./types";

export function createTsProject(files: ParserFile[]): {
  project: Project;
  sourceFiles: SourceFile[];
} {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipLoadingLibFiles: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      target: ScriptTarget.ESNext,
      allowJs: true,
      noResolve: true,
    },
  });

  const sourceFiles = files.map((file) =>
    project.createSourceFile(normalizePath(file.path), file.content, { overwrite: true }),
  );

  return { project, sourceFiles };
}

/** Per file, so one unparsable paste cannot bury the panel in messages. */
const MAX_SYNTAX_DIAGNOSTICS = 20;

export function syntacticDiagnostics(project: Project, sourceFiles: SourceFile[]): ParseDiagnostic[] {
  const program = project.getProgram();
  const diagnostics: ParseDiagnostic[] = [];

  for (const sourceFile of sourceFiles) {
    for (const diagnostic of program
      .getSyntacticDiagnostics(sourceFile)
      .slice(0, MAX_SYNTAX_DIAGNOSTICS)) {
      diagnostics.push({
        level: "error",
        message: ts.flattenDiagnosticMessageText(diagnostic.compilerObject.messageText, " "),
        file: fileLabel(sourceFile),
        line: diagnostic.getLineNumber(),
      });
    }
  }

  return diagnostics;
}

/**
 * How a file is named in diagnostics and on tables: the path it was imported
 * with, so `schemas/user.ts` and `admin/user.ts` stay apart and every message
 * points at an editor tab.
 */
export function fileLabel(sourceFile: SourceFile): string {
  return sourceFile.getFilePath().replace(/^\/+/, "");
}

function normalizePath(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  return `/${trimmed || "schema.ts"}`;
}
