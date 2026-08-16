import { runStaticChecks } from "@/lib/analysis/static-checks";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { toLocale } from "@/lib/i18n/locales";
import { toOrmId } from "@/lib/orm/catalog";
import { parseSchema, toParserFiles } from "@/lib/orm/parse";

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
 */

const MAX_INPUT_BYTES = 256 * 1024;

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

  if (typeof rawSources !== "object" || rawSources === null) {
    return Response.json({ error: messages.schemaRequired }, { status: 400 });
  }

  const files = toParserFiles(orm, rawSources as Record<string, unknown>);
  if (files.length === 0) {
    return Response.json({ error: messages.schemaRequired }, { status: 400 });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.content.length, 0);
  if (totalBytes > MAX_INPUT_BYTES) {
    return Response.json({ error: messages.tooLarge(MAX_INPUT_BYTES / 1024) }, { status: 413 });
  }

  const schema = parseSchema(orm, files, locale);

  return Response.json({
    schema,
    staticFindings: runStaticChecks(schema, locale),
  });
}
