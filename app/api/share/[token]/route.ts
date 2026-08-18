import { requestIsAuthorized } from "@/lib/auth/session";
import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest } from "@/lib/i18n/locales";
import { checkShareOpenQuota, tooManyRequests } from "@/lib/security/quota";
import { clientKey } from "@/lib/security/rate-limit";
import { consumeShare, peekShare } from "@/lib/share/store";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  request: Request,
  context: RouteContext<"/api/share/[token]">,
): Promise<Response> {
  if (!(await requestIsAuthorized(request))) {
    return Response.json(
      { error: API_MESSAGES[localeFromRequest(request)].unauthorized },
      { status: 401, headers: NO_STORE },
    );
  }

  const denied = checkShareOpenQuota(clientKey(request));
  if (denied) {
    return tooManyRequests(API_MESSAGES[localeFromRequest(request)].tooManyRequests, denied);
  }

  const { token } = await context.params;
  const meta = await peekShare(token);

  if (!meta) {
    return Response.json({ available: false }, { status: 404, headers: NO_STORE });
  }
  return Response.json({ available: true, ...meta }, { headers: NO_STORE });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/share/[token]">,
): Promise<Response> {
  if (!(await requestIsAuthorized(request))) {
    return Response.json(
      { error: API_MESSAGES[localeFromRequest(request)].unauthorized },
      { status: 401, headers: NO_STORE },
    );
  }

  const denied = checkShareOpenQuota(clientKey(request));
  if (denied) {
    return tooManyRequests(API_MESSAGES[localeFromRequest(request)].tooManyRequests, denied);
  }

  const { token } = await context.params;
  const payload = await consumeShare(token);

  if (!payload) {
    return Response.json(
      { error: API_MESSAGES[localeFromRequest(request)].linkGone },
      { status: 410, headers: NO_STORE },
    );
  }
  return Response.json(payload, { headers: NO_STORE });
}
