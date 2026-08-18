import { google } from "@ai-sdk/google";
import {
  Output,
  createTextStreamResponse,
  streamText,
  type TextStreamPart,
  type ToolSet,
} from "ai";

import { analysisSchema } from "@/lib/ai/analysis-schema";
import { buildAnalysisPrompt, buildSystemPrompt } from "@/lib/ai/prompt";
import { runStaticChecks } from "@/lib/analysis/static-checks";
import { requestIsAuthorized } from "@/lib/auth/session";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest, toLocale } from "@/lib/i18n/locales";
import { toOrmId } from "@/lib/orm/catalog";
import { parseSchema, toParserFiles } from "@/lib/orm/parse";
import { MAX_SOURCE_BYTES, readLimitedJson } from "@/lib/security/body";
import { checkAiQuota, tooManyRequests } from "@/lib/security/quota";
import { clientKey } from "@/lib/security/rate-limit";

export const maxDuration = 60;

const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const IS_DEV = process.env.NODE_ENV === "development";

export async function POST(request: Request): Promise<Response> {
  if (!(await requestIsAuthorized(request))) {
    return Response.json(
      { error: API_MESSAGES[localeFromRequest(request)].unauthorized },
      { status: 401 },
    );
  }

  const denied = checkAiQuota(clientKey(request));
  if (denied) {
    return tooManyRequests(API_MESSAGES[localeFromRequest(request)].aiLimit, denied);
  }

  const body = await readLimitedJson(request);
  if (!body.ok) {
    const fallback = API_MESSAGES[localeFromRequest(request)];
    return body.reason === "too-large"
      ? Response.json({ error: fallback.tooLarge(MAX_SOURCE_BYTES / 1024) }, { status: 413 })
      : Response.json({ error: fallback.invalidJson }, { status: 400 });
  }

  const {
    orm: rawOrm,
    sources: rawSources,
    locale: rawLocale,
  } = (body.value ?? {}) as Record<string, unknown>;
  const locale = toLocale(rawLocale);
  const messages = API_MESSAGES[locale];
  const orm = toOrmId(rawOrm);

  if (typeof rawSources !== "object" || rawSources === null) {
    return Response.json({ error: messages.schemaRequired }, { status: 400 });
  }

  const files = toParserFiles(orm, rawSources as Record<string, unknown>);
  if (files.length === 0) {
    return Response.json({ error: messages.schemaRequired }, { status: 400 });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.content.length, 0);
  if (totalBytes > MAX_SOURCE_BYTES) {
    return Response.json({ error: messages.tooLarge(MAX_SOURCE_BYTES / 1024) }, { status: 413 });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error("[analyze] GOOGLE_GENERATIVE_AI_API_KEY is not set.");
    return unavailable(IS_DEV ? messages.missingApiKey : messages.aiLimit);
  }

  const parsed = parseSchema(orm, files, locale);
  if (parsed.tables.length === 0) {
    return Response.json({ error: messages.noTables }, { status: 422 });
  }

  const system = buildSystemPrompt(locale, orm);
  const prompt = buildAnalysisPrompt(parsed, runStaticChecks(parsed, locale));

  const candidates = [
    process.env.AI_MODEL ?? DEFAULT_MODEL,
    process.env.AI_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL,
  ].filter((id, index, all) => all.indexOf(id) === index);

  let detail: string | null = null;

  for (const modelId of candidates) {
    const result = streamText({
      model: google(modelId),
      system,
      output: Output.object({ schema: analysisSchema }),
      prompt,
      abortSignal: request.signal,
      onError: ({ error }) => console.error(`[analyze] ${modelId} stream error:`, error),
    });

    const opened = await openTextStream(result.stream);
    if (opened.ok) {
      return createTextStreamResponse({
        stream: opened.stream,
        headers: { "Cache-Control": "no-store" },
      });
    }

    detail = opened.detail;
    if (request.signal.aborted) break;
    console.warn(`[analyze] ${modelId} failed to start, trying the next model.`);
  }

  return unavailable(IS_DEV && detail ? detail : messages.aiLimit);
}

type OpenResult =
  | { ok: true; stream: ReadableStream<string> }
  | { ok: false; detail: string | null };

async function openTextStream(
  parts: AsyncIterable<TextStreamPart<ToolSet>>,
): Promise<OpenResult> {
  const iterator = parts[Symbol.asyncIterator]();
  let first: string | null = null;

  try {
    while (first === null) {
      const { done, value } = await iterator.next();
      if (done) break;
      if (value.type === "error") throw value.error;
      if (value.type === "text-delta" && value.text.length > 0) first = value.text;
    }
  } catch (error) {
    console.error("[analyze] could not start the model stream:", error);
    void iterator.return?.();
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }

  if (first === null) {
    console.error("[analyze] the model produced no text.");
    return { ok: false, detail: null };
  }

  const head = first;

  return {
    ok: true,
    stream: new ReadableStream<string>({
      start(controller) {
        controller.enqueue(head);
      },
      async pull(controller) {
        try {
          while (true) {
            const { done, value } = await iterator.next();
            if (done) {
              controller.close();
              return;
            }
            if (value.type === "error") throw value.error;
            if (value.type === "text-delta") {
              controller.enqueue(value.text);
              return;
            }
          }
        } catch (error) {
          console.error("[analyze] stream failed mid-flight:", error);
          controller.close();
        }
      },
      cancel() {
        void iterator.return?.();
      },
    }),
  };
}

function unavailable(message: string): Response {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Retry-After": "300", "Cache-Control": "no-store" } },
  );
}
