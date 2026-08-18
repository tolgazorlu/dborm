import { timingSafeEqual } from "node:crypto";

import { AUTH_ENABLED, sameOrigin, setupToken } from "@/lib/auth/config";
import { hashPassword, isStrongEnough, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/responses";
import { accountExists, createAccount, createSession } from "@/lib/auth/store";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest } from "@/lib/i18n/locales";
import { readLimitedJson } from "@/lib/security/body";
import { checkAuthQuota, tooManyRequests } from "@/lib/security/quota";
import { clientKey } from "@/lib/security/rate-limit";

const MAX_BODY_BYTES = 4 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tokenMatches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const messages = API_MESSAGES[localeFromRequest(request)];

  if (!AUTH_ENABLED) return Response.json({ error: messages.notFound }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: messages.badOrigin }, { status: 403 });

  const denied = checkAuthQuota(clientKey(request));
  if (denied) return tooManyRequests(messages.tooManyRequests, denied);

  if (await accountExists()) {
    return Response.json({ error: messages.setupClosed }, { status: 409 });
  }

  const body = await readLimitedJson(request, MAX_BODY_BYTES);
  if (!body.ok) return Response.json({ error: messages.invalidJson }, { status: 400 });

  const { email, password, token } = (body.value ?? {}) as Record<string, unknown>;

  const expectedToken = setupToken();
  if (expectedToken && (typeof token !== "string" || !tokenMatches(token, expectedToken))) {
    return Response.json({ error: messages.invalidSetupToken }, { status: 403 });
  }

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    return Response.json({ error: messages.invalidEmail }, { status: 400 });
  }
  if (typeof password !== "string" || !isStrongEnough(password)) {
    return Response.json({ error: messages.weakPassword(MIN_PASSWORD_LENGTH) }, { status: 400 });
  }

  const created = await createAccount(email, await hashPassword(password));
  if (!created) return Response.json({ error: messages.setupClosed }, { status: 409 });

  const { token: sessionToken, expiresAt } = await createSession(email.trim().toLowerCase());

  return Response.json(
    { ok: true },
    {
      status: 201,
      headers: {
        "Set-Cookie": setSessionCookie(request, sessionToken, expiresAt),
        "Cache-Control": "no-store",
      },
    },
  );
}
