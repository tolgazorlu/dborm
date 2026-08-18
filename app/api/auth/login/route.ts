import { AUTH_ENABLED, sameOrigin } from "@/lib/auth/config";
import { burnTime, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/responses";
import { createSession, emailMatches, readAccount } from "@/lib/auth/store";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest } from "@/lib/i18n/locales";
import { readLimitedJson } from "@/lib/security/body";
import { checkAuthQuota, tooManyRequests } from "@/lib/security/quota";
import { clientKey } from "@/lib/security/rate-limit";

const MAX_BODY_BYTES = 4 * 1024;

export async function POST(request: Request): Promise<Response> {
  const messages = API_MESSAGES[localeFromRequest(request)];

  if (!AUTH_ENABLED) return Response.json({ error: messages.notFound }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: messages.badOrigin }, { status: 403 });

  const denied = checkAuthQuota(clientKey(request));
  if (denied) return tooManyRequests(messages.tooManyRequests, denied);

  const body = await readLimitedJson(request, MAX_BODY_BYTES);
  if (!body.ok) return Response.json({ error: messages.invalidJson }, { status: 400 });

  const { email, password } = (body.value ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    return Response.json({ error: messages.invalidCredentials }, { status: 401 });
  }

  const account = await readAccount();
  if (!account) {
    await burnTime(password);
    return Response.json({ error: messages.invalidCredentials }, { status: 401 });
  }

  const emailOk = emailMatches(email, account.email);
  const passwordOk = await verifyPassword(password, account.passwordHash);

  if (!emailOk || !passwordOk) {
    return Response.json({ error: messages.invalidCredentials }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(account.email);

  return Response.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": setSessionCookie(request, token, expiresAt),
        "Cache-Control": "no-store",
      },
    },
  );
}
