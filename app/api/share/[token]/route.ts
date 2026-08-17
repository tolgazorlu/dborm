import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { localeFromRequest } from "@/lib/i18n/locales";
import { checkShareOpenQuota, tooManyRequests } from "@/lib/security/quota";
import { clientKey } from "@/lib/security/rate-limit";
import { consumeShare, peekShare } from "@/lib/share/store";

/** Paylaşım yanıtları hiçbir katmanda önbelleğe alınmamalı. */
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET **tüketmez**, sadece linkin hâlâ geçerli olup olmadığına bakar.
 *
 * Tüketmenin GET'te olmaması bilinçli: mesajlaşma uygulamalarının link
 * önizlemesi, tarayıcı ön-getirmesi ya da antivirüs taraması bir GET atar ve
 * link kullanıcı görmeden yanardı. Bu yüzden içerik yalnızca kullanıcının
 * bilerek tetiklediği POST ile açılır.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/share/[token]">,
): Promise<Response> {
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

/** İçeriği döndürür ve kaydı kalıcı olarak siler. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/share/[token]">,
): Promise<Response> {
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
