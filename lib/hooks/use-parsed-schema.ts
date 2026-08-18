import { useEffect, useState } from "react";

import type { Finding } from "@/lib/analysis/types";
import type { Locale } from "@/lib/i18n/locales";
import { emptySchema, type OrmId, type ParsedSchema } from "@/lib/orm/types";

interface ParseState {
  schema: ParsedSchema;
  staticFindings: Finding[];
  isParsing: boolean;
  error: string | null;
}

export function useParsedSchema(
  orm: OrmId,
  sources: Record<string, string>,
  locale: Locale,
  delayMs = 400,
): ParseState {
  const [state, setState] = useState<ParseState>(() => ({
    schema: emptySchema(orm),
    staticFindings: [],
    isParsing: true,
    error: null,
  }));

  const sourcesKey = JSON.stringify(sources);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, isParsing: true }));

    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orm, locale, sources: JSON.parse(sourcesKey) }),
          signal: controller.signal,
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`);

        setState({
          schema: payload.schema as ParsedSchema,
          staticFindings: (payload.staticFindings ?? []) as Finding[],
          isParsing: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          isParsing: false,
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        }));
      }
    }, delayMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [orm, sourcesKey, locale, delayMs]);

  return state;
}
