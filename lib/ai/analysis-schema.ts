import { z } from "zod";

import { CATEGORIES, SEVERITIES } from "@/lib/analysis/types";

export const analysisSchema = z.object({
  summary: z.string().describe("2-3 sentence overall assessment of the schema."),
  healthScore: z.number().describe("Overall schema health from 0 to 100. 100 = no issues."),
  findings: z
    .array(
      z.object({
        id: z.string().describe("kebab-case unique id, e.g. 'posts-missing-index'"),
        severity: z.enum(SEVERITIES),
        category: z.enum(CATEGORIES),
        title: z.string().describe("Single-line title."),
        table: z
          .string()
          .nullable()
          .describe("Code identifier of the related table; null for general findings."),
        columns: z
          .array(z.string())
          .nullable()
          .describe("Code identifiers of the related columns; null if not applicable."),
        description: z.string().describe("Why this matters."),
        suggestion: z.string().describe("Concrete, actionable suggestion."),
        codeFix: z
          .string()
          .nullable()
          .describe("Snippet applying the suggestion in the project's ORM; null if not applicable."),
      }),
    )
    .describe("At most 12 findings, most critical first."),
});

export type SchemaAnalysis = z.infer<typeof analysisSchema>;
