import { google } from "@ai-sdk/google";
import { Output, createTextStreamResponse, streamText, toTextStream } from "ai";

import { analysisSchema } from "@/lib/ai/analysis-schema";
import { buildAnalysisPrompt, buildSystemPrompt } from "@/lib/ai/prompt";
import { runStaticChecks } from "@/lib/analysis/static-checks";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { toLocale } from "@/lib/i18n/locales";
import { toOrmId } from "@/lib/orm/catalog";
import { parseSchema, toParserFiles } from "@/lib/orm/parse";

/** Analiz uzun sürebilir; barındırma platformlarındaki kısa varsayılanı yükseltiyoruz. */
export const maxDuration = 60;

/**
 * İstemci ham kodu gönderir, sunucu **yeniden ayrıştırır**.
 *
 * İstemcinin gönderdiği JSON'a güvenip doğrudan modele vermek, istemci
 * tarafında bozulmuş/uydurulmuş bir şemanın prompt'a girmesi demek olurdu.
 * Aynı parser'ı burada tekrar çalıştırmak hem ucuz hem de tek doğruluk kaynağı.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: API_MESSAGES.tr.invalidJson }, { status: 400 });
  }

  const { orm: rawOrm, sources: rawSources, locale: rawLocale } = (body ?? {}) as Record<string, unknown>;
  const locale = toLocale(rawLocale);
  const messages = API_MESSAGES[locale];
  const orm = toOrmId(rawOrm);

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: messages.missingApiKey }, { status: 501 });
  }

  if (typeof rawSources !== "object" || rawSources === null) {
    return Response.json({ error: messages.schemaRequired }, { status: 400 });
  }

  const files = toParserFiles(orm, rawSources as Record<string, unknown>);
  if (files.length === 0) {
    return Response.json({ error: messages.schemaRequired }, { status: 400 });
  }

  const parsed = parseSchema(orm, files, locale);
  if (parsed.tables.length === 0) {
    return Response.json({ error: messages.noTables }, { status: 422 });
  }

  const result = streamText({
    model: google(process.env.AI_MODEL ?? "gemini-1.5-flash"),
    system: buildSystemPrompt(locale, orm),
    output: Output.object({ schema: analysisSchema }),
    prompt: buildAnalysisPrompt(parsed, runStaticChecks(parsed, locale)),
  });

  // `useObject` düz metin akışı bekler: model JSON'u ürettikçe parça parça iner.
  return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) });
}
