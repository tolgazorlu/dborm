import { AUTH_ENABLED, sameOrigin } from "@/lib/auth/config";
import { clearSessionCookies } from "@/lib/auth/responses";
import { sessionTokenFrom } from "@/lib/auth/session";
import { destroySession } from "@/lib/auth/store";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest } from "@/lib/i18n/locales";

export async function POST(request: Request): Promise<Response> {
  const messages = API_MESSAGES[localeFromRequest(request)];

  if (!AUTH_ENABLED) return Response.json({ error: messages.notFound }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: messages.badOrigin }, { status: 403 });

  await destroySession(sessionTokenFrom(request));

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const cookie of clearSessionCookies(request)) headers.append("Set-Cookie", cookie);

  return Response.json({ ok: true }, { status: 200, headers });
}
