import { API_MESSAGES } from "@/lib/i18n/api-messages";
import { toLocale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE } from "@/lib/i18n/locales";
import { consumeShare, peekShare } from "@/lib/share/store";

/**
 * GET **tüketmez**, sadece linkin hâlâ geçerli olup olmadığına bakar.
 *
 * Tüketmenin GET'te olmaması bilinçli: mesajlaşma uygulamalarının link
 * önizlemesi, tarayıcı ön-getirmesi ya da antivirüs taraması bir GET atar ve
 * link kullanıcı görmeden yanardı. Bu yüzden içerik yalnızca kullanıcının
 * bilerek tetiklediği POST ile açılır.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/share/[token]">,
): Promise<Response> {
  const { token } = await context.params;
  const meta = await peekShare(token);

  if (!meta) {
    return Response.json({ available: false }, { status: 404 });
  }
  return Response.json({ available: true, ...meta });
}

/** İçeriği döndürür ve kaydı kalıcı olarak siler. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/share/[token]">,
): Promise<Response> {
  const { token } = await context.params;
  const payload = await consumeShare(token);

  if (!payload) {
    const locale = toLocale(readCookie(request, LOCALE_COOKIE));
    return Response.json({ error: API_MESSAGES[locale].linkGone }, { status: 410 });
  }
  return Response.json(payload);
}

function readCookie(request: Request, name: string): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}
