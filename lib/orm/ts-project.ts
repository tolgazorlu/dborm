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

export function syntacticDiagnostics(project: Project, sourceFiles: SourceFile[]): ParseDiagnostic[] {
  const program = project.getProgram();
  const diagnostics: ParseDiagnostic[] = [];

  for (const sourceFile of sourceFiles) {
    for (const diagnostic of program.getSyntacticDiagnostics(sourceFile)) {
      diagnostics.push({
        level: "error",
        message: ts.flattenDiagnosticMessageText(diagnostic.compilerObject.messageText, " "),
        file: sourceFile.getBaseName(),
        line: diagnostic.getLineNumber(),
      });
    }
  }

  return diagnostics;
}

function normalizePath(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  return `/${trimmed || "schema.ts"}`;
}
