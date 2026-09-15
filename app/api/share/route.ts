import { requestIsAuthorized } from "@/lib/auth/session";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest, toLocale } from "@/lib/i18n/locales";
import { ORM_CATALOG, toOrmId } from "@/lib/orm/catalog";
import { normalizeFileName } from "@/lib/orm/files";
import { MAX_SOURCE_BYTES, readLimitedJson } from "@/lib/security/body";
import { checkShareCreateQuota, tooManyRequests } from "@/lib/security/quota";
import { clientKey } from "@/lib/security/rate-limit";
import { createShare } from "@/lib/share/store";

export async function POST(request: Request): Promise<Response> {
  if (!(await requestIsAuthorized(request))) {
    return Response.json(
      { error: API_MESSAGES[localeFromRequest(request)].unauthorized },
      { status: 401 },
    );
  }

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

  const builtInKeys = new Set(ORM_CATALOG[orm].files.map((file) => file.key));
  const sources: Record<string, string> = {};

  for (const [key, value] of Object.entries(rawSources as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    if (!builtInKeys.has(key) && normalizeFileName(key) !== key) continue;
    sources[key] = value;
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
