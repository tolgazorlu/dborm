/**
 * Satır içi script'i React'in geliştirme uyarısı olmadan render eder.
 *
 * React, istemcide render edilen `<script>` etiketlerinin çalışmayacağını
 * söyleyen bir uyarı basar. Sunucuda `text/javascript`, istemcide `text/plain`
 * yazarak uyarıyı susturuyoruz: script yalnızca ilk HTML ayrıştırılırken
 * (yani gerçekten çalıştığı yerde) etkin oluyor.
 *
 * Kaynak: node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export default function InlineScript({ html, nonce }: { html: string; nonce?: string }) {
  return (
    <script
      // Next kendi ürettiği etiketlere nonce'u otomatik koyuyor; elle
      // yazdığımız bu etikete `proxy.ts`'in ürettiği değeri biz veriyoruz,
      // yoksa CSP script'i engeller ve tema ilk boyamada yanıp söner.
      nonce={nonce}
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
