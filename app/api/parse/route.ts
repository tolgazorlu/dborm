import { runStaticChecks } from "@/lib/analysis/static-checks";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest, toLocale } from "@/lib/i18n/locales";
import { toOrmId } from "@/lib/orm/catalog";
import { parseSchema, toParserFiles } from "@/lib/orm/parse";
import { MAX_SOURCE_BYTES, readLimitedJson } from "@/lib/security/body";
import { checkParseQuota, tooManyRequests } from "@/lib/security/quota";
import { clientKey } from "@/lib/security/rate-limit";

/**
 * Ayrıştırma neden sunucuda?
 *
 * ts-morph, TypeScript derleyicisini de beraberinde getirir (~6 MB). Bunu
 * istemci paketine koymak ilk yükleme süresini uçurur. Route handler'da
 * çalıştırınca istemci sadece JSON indirir; debounce sonrası çağrıldığı için
 * gecikme hissedilmez.
 *
 * Parser'lar saf fonksiyon (`lib/orm/*`), tarayıcıda çalıştırmak isterseniz
 * aynı fonksiyonu bir Web Worker içinde çağırmanız yeterli.
 *
 * Bedeli de burada: her istek derleyiciyi çalıştırıyor. Girdi boyutu ve istek
 * sayısı bu yüzden sınırlı — aksi halde tek bir istemci CPU'yu doldurabilir.
 */

export async function POST(request: Request): Promise<Response> {
  const denied = checkParseQuota(clientKey(request));
  if (denied) {
    return tooManyRequests(API_MESSAGES[localeFromRequest(request)].tooManyRequests, denied);
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

  const schema = parseSchema(orm, files, locale);

  return Response.json(
    {
      schema,
      staticFindings: runStaticChecks(schema, locale),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
