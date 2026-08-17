import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest, toLocale } from "@/lib/i18n/locales";
import { ORM_CATALOG, toOrmId } from "@/lib/orm/catalog";
import { MAX_SOURCE_BYTES, readLimitedJson } from "@/lib/security/body";
import { checkShareCreateQuota, tooManyRequests } from "@/lib/security/quota";
import { clientKey } from "@/lib/security/rate-limit";
import { createShare } from "@/lib/share/store";

/**
 * Tek kullanımlık paylaşım linki oluşturur.
 *
 * Link `/s/<token>` adresine işaret eder; o sayfa açıldığında içerik **okunup
 * silinir**, ikinci ziyarette artık yoktur. Mutlak URL'i istekten türetiyoruz
 * ki tünel/farklı port/farklı alan adı durumlarında da doğru çalışsın.
 *
 * Her kayıt diske yazdığı için istek sayısı sınırlı: sınırsız olsaydı diski
 * doldurmak bedava bir saldırı olurdu.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = checkShareCreateQuota(clientKey(request));
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
  const messages = API_MESSAGES[toLocale(rawLocale)];
  const orm = toOrmId(rawOrm);

  if (typeof rawSources !== "object" || rawSources === null) {
    return Response.json({ error: messages.schemaRequired }, { status: 400 });
  }

  // Yalnızca bu ORM'e ait dosya anahtarlarını saklıyoruz.
  const sources: Record<string, string> = {};
  for (const file of ORM_CATALOG[orm].files) {
    const value = (rawSources as Record<string, unknown>)[file.key];
    if (typeof value === "string") sources[file.key] = value;
  }

  const total = Object.values(sources).join("").length;
  if (total === 0) {
    return Response.json({ error: messages.schemaRequired }, { status: 400 });
  }
  if (total > MAX_SOURCE_BYTES) {
    return Response.json({ error: messages.tooLarge(MAX_SOURCE_BYTES / 1024) }, { status: 413 });
  }

  const { token, record } = await createShare({ orm, sources });

  return Response.json(
    {
      token,
      url: new URL(`/s/${token}`, request.url).toString(),
      expiresAt: record.expiresAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
