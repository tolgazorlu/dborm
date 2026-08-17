import { google } from "@ai-sdk/google";
import { Output, createTextStreamResponse, streamText, type TextStreamPart } from "ai";

import { analysisSchema } from "@/lib/ai/analysis-schema";
import { buildAnalysisPrompt, buildSystemPrompt } from "@/lib/ai/prompt";
import { runStaticChecks } from "@/lib/analysis/static-checks";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest, toLocale } from "@/lib/i18n/locales";
import { toOrmId } from "@/lib/orm/catalog";
import { parseSchema, toParserFiles } from "@/lib/orm/parse";
import { MAX_SOURCE_BYTES, readLimitedJson } from "@/lib/security/body";
import { checkAiQuota, tooManyRequests } from "@/lib/security/quota";
import { clientKey } from "@/lib/security/rate-limit";

/** Analiz uzun sürebilir; barındırma platformlarındaki kısa varsayılanı yükseltiyoruz. */
export const maxDuration = 60;

/**
 * `gemini-1.5-flash` emekliye ayrıldı; güncel ve ucuz bir varsayılan gerekiyor.
 * `AI_MODEL` ile değiştirilebilir.
 */
const DEFAULT_MODEL = "gemini-3.5-flash";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * İstemci ham kodu gönderir, sunucu **yeniden ayrıştırır**.
 *
 * İstemcinin gönderdiği JSON'a güvenip doğrudan modele vermek, istemci
 * tarafında bozulmuş/uydurulmuş bir şemanın prompt'a girmesi demek olurdu.
 * Aynı parser'ı burada tekrar çalıştırmak hem ucuz hem de tek doğruluk kaynağı.
 *
 * Hata politikası: model tarafındaki **hiçbir** arıza istemciye olduğu gibi
 * yansımıyor. Kota aşımı, geçersiz anahtar, sağlayıcı kesintisi, bozuk çıktı —
 * hepsi tek bir 429 ve tek bir "günlük limit doldu" mesajı. Sebebi bilerek
 * seçildi: dışarıya sunucunun yapılandırması hakkında bilgi sızdırmamak
 * (anahtar var mı? hangi model? hangi sağlayıcı hatası?) ve kullanıcıya
 * anlamsız teknik metin göstermemek. Gerçek hata sunucu günlüğüne düşer,
 * geliştirme ortamında ise ekrana da gelir.
 */
export async function POST(request: Request): Promise<Response> {
  // Kota kontrolü gövdeyi okumadan önce: reddedilen istek ne bellek ne CPU
  // harcasın. Dil, gövde yerine çerezden okunuyor (istemci ikisini de aynı
  // değere ayarlıyor).
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
    return Response.json(
      { error: messages.tooLarge(MAX_SOURCE_BYTES / 1024) },
      { status: 413 },
    );
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error("[analyze] GOOGLE_GENERATIVE_AI_API_KEY tanımlı değil.");
    return unavailable(IS_DEV ? messages.missingApiKey : messages.aiLimit);
  }

  const parsed = parseSchema(orm, files, locale);
  if (parsed.tables.length === 0) {
    return Response.json({ error: messages.noTables }, { status: 422 });
  }

  const result = streamText({
    model: google(process.env.AI_MODEL ?? DEFAULT_MODEL),
    system: buildSystemPrompt(locale, orm),
    output: Output.object({ schema: analysisSchema }),
    prompt: buildAnalysisPrompt(parsed, runStaticChecks(parsed, locale)),
    // İstemci "Durdur"a bastığında ya da sekmeyi kapattığında model çağrısı da
    // iptal olsun; aksi halde kotayı kimsenin okumayacağı token'lar harcar.
    abortSignal: request.signal,
    onError: ({ error }) => console.error("[analyze] model akış hatası:", error),
  });

  const opened = await openTextStream(result.stream);
  if (!opened.ok) {
    return unavailable(IS_DEV && opened.detail ? opened.detail : messages.aiLimit);
  }

  // `useObject` düz metin akışı bekler: model JSON'u ürettikçe parça parça iner.
  return createTextStreamResponse({
    stream: opened.stream,
    headers: { "Cache-Control": "no-store" },
  });
}

type OpenResult =
  | { ok: true; stream: ReadableStream<string> }
  | { ok: false; detail: string | null };

/**
 * Akışı, **ilk metin parçası gelene kadar** bekleyerek açar.
 *
 * Gerekçe: `createTextStreamResponse` çağrıldığı anda 200 başlıkları gider.
 * Model çağrısı ondan sonra patlarsa artık durum kodunu değiştiremeyiz;
 * istemci boş bir gövde alır ve "sonuç yok" gibi görünür. İlk parçayı önden
 * beklemek, "model hiç başlayamadı" durumunu düzgün bir 429'a çevirir. Ek
 * gecikme yok: kullanıcı zaten ilk token'ı bekliyor.
 *
 * İlk parça geldikten sonraki hatalarda yapılabilecek tek şey akışı kapatmak.
 * Bu durumda istemcide kısmi bir nesne kalır ve hata mesajı gösterilir.
 */
async function openTextStream(
  parts: AsyncIterable<TextStreamPart<Record<string, never>>>,
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
    console.error("[analyze] model akışı başlatılamadı:", error);
    void iterator.return?.();
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }

  if (first === null) {
    console.error("[analyze] model hiç metin üretmedi.");
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
          const { done, value } = await iterator.next();
          if (done) {
            controller.close();
            return;
          }
          if (value.type === "error") throw value.error;
          if (value.type === "text-delta") controller.enqueue(value.text);
          // Diğer parça türleri (adım başlangıcı, bitiş, kullanım) istemciyi
          // ilgilendirmiyor; hiçbir şey sıraya konmazsa `pull` yeniden çağrılır.
        } catch (error) {
          console.error("[analyze] akış ortasında hata:", error);
          controller.close();
        }
      },
      cancel() {
        void iterator.return?.();
      },
    }),
  };
}

/**
 * Model tarafındaki her arıza için tek yanıt. 429 seçilmesi bilinçli: istemci
 * "kota doldu" ile "sağlayıcı çöktü"yü ayırt edemesin.
 */
function unavailable(message: string): Response {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Retry-After": "300", "Cache-Control": "no-store" } },
  );
}
