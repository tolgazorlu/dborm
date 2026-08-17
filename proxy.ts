import { NextResponse, type NextRequest } from "next/server";

/**
 * İçerik Güvenliği Politikası (CSP).
 *
 * Next 16'da `middleware.ts` yerine `proxy.ts`. Buradan geçmesinin sebebi
 * nonce: her istek için yeni bir rastgele değer üretilip hem başlığa hem
 * satır içi script'e yazılıyor. Next, başlıktaki `'nonce-...'` kalıbını
 * okuyup kendi ürettiği script etiketlerine aynı değeri koyuyor; bizim elle
 * yazdığımız tek satır içi script'e (tema) nonce'u `x-nonce` başlığı üzerinden
 * kök layout aktarıyor.
 *
 * `strict-dynamic`: nonce'lu bir script'in `createElement` ile yüklediği
 * script'lere güvenilir. Monaco (jsdelivr CDN'inden AMD loader'ı ile) ve
 * Clarity tam olarak böyle yükleniyor, dolayısıyla ana kural "yalnızca bizim
 * başlattığımız script'ler" oluyor — enjekte edilmiş bir `<script>` etiketi
 * nonce bilemeyeceği için çalışmaz.
 *
 * Alan adı listesi yine de duruyor: `strict-dynamic` desteklemeyen eski
 * tarayıcılar ve Monaco'nun `importScripts` kullanan worker'ları için geri
 * düşüş yolu.
 *
 * `style-src` bilinçli olarak `'unsafe-inline'`: Monaco temayı çalışma
 * zamanında `<style>` etiketleriyle basıyor ve bileşenlerde `style={{...}}`
 * kullanılıyor. Nonce eklemek `'unsafe-inline'`i geçersiz kılıp editörü
 * kırardı — stil enjeksiyonu ise script enjeksiyonunun yanında düşük riskli.
 */

const MONACO_CDN = "https://cdn.jsdelivr.net";
const CLARITY = "https://www.clarity.ms https://*.clarity.ms https://c.bing.com";

export function proxy(request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = btoa(crypto.randomUUID());

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    // Tıklama hırsızlığı (clickjacking): sayfa hiçbir iframe'e gömülemez.
    "frame-ancestors 'none'",
    "form-action 'self'",
    // `unsafe-eval` yalnızca geliştirmede: React hata yığınlarını yeniden
    // kurarken `eval` kullanıyor. Üretimde gerekmiyor.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${MONACO_CDN} ${CLARITY}${
      isDev ? " 'unsafe-eval'" : ""
    }`,
    `style-src 'self' 'unsafe-inline' ${MONACO_CDN}`,
    `font-src 'self' data: ${MONACO_CDN}`,
    `img-src 'self' data: blob: ${CLARITY}`,
    `connect-src 'self' ${MONACO_CDN} ${CLARITY}`,
    // Monaco dil sunucularını blob URL'inden worker olarak başlatıyor.
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];

  const policy = directives.join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      /**
       * API yanıtları JSON; CSP oradaki tek şey olan `Content-Type`'a bir şey
       * katmıyor (diğer güvenlik başlıkları `next.config.ts`'te ve her yola
       * uygulanıyor). Statik dosyalar da dışarıda: her istekte nonce üretmek
       * boşuna iş olurdu.
       */
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
