import type { NextConfig } from "next";

/**
 * Her yola uygulanan güvenlik başlıkları.
 *
 * CSP burada değil `proxy.ts`'te: istek başına nonce üretmesi gerekiyor,
 * `headers()` ise sabit değerler döndürüyor.
 */
const SECURITY_HEADERS = [
  // MIME türü tahmini kapalı: yüklenen bir metin dosyası "script" diye
  // çalıştırılamasın.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // CSP `frame-ancestors` desteklemeyen tarayıcılar için eş karşılık.
  { key: "X-Frame-Options", value: "DENY" },
  // Paylaşım linkinin token'ı adres çubuğunda; dış sitelere yalnızca kaynak
  // (origin) gitsin, tam yol değil.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Yalnızca HTTPS üzerinden servis edildiğinde anlamlı; tarayıcı http:// ile
  // gelen yanıtlarda başlığı zaten yok sayar.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  /**
   * ts-morph, TypeScript derleyicisini ve dosya sistemi erişimini içerir.
   * Bundle'a dahil edilmek yerine sunucuda doğrudan `require` edilmeli;
   * aksi halde derleyicinin dinamik `require`'ları paketleyicide bozulur.
   */
  serverExternalPackages: ["ts-morph"],

  // Sunucu sürümünü açık etmenin kimseye faydası yok.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
