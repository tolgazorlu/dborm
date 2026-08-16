import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { toLocale } from "@/lib/i18n/locales";
import { ORM_CATALOG, toOrmId } from "@/lib/orm/catalog";
import { createShare } from "@/lib/share/store";

const MAX_INPUT_BYTES = 256 * 1024;

/**
 * Tek kullanımlık paylaşım linki oluşturur.
 *
 * Link `/s/<token>` adresine işaret eder; o sayfa açıldığında içerik **okunup
 * silinir**, ikinci ziyarette artık yoktur. Mutlak URL'i istekten türetiyoruz
 * ki tünel/farklı port/farklı alan adı durumlarında da doğru çalışsın.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: API_MESSAGES.tr.invalidJson }, { status: 400 });
  }

  const { orm: rawOrm, sources: rawSources, locale: rawLocale } = (body ?? {}) as Record<string, unknown>;
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
  if (total > MAX_INPUT_BYTES) {
    return Response.json({ error: messages.tooLarge(MAX_INPUT_BYTES / 1024) }, { status: 413 });
  }

  const { token, record } = await createShare({ orm, sources });

  return Response.json({
    token,
    url: new URL(`/s/${token}`, request.url).toString(),
    expiresAt: record.expiresAt,
  });
}
