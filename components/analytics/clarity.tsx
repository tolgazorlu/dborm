import Script from "next/script";

/**
 * Microsoft Clarity oturum analitiği.
 *
 * Kimlik gizli bir değer değil — sayfa kaynağında zaten görünür — bu yüzden
 * ortam değişkeni yerine burada duruyor; kurulum adımı gerektirmiyor.
 *
 * Geliştirme ortamında yüklenmiyor: yerel gezinmeler panoya gerçek oturum
 * olarak düşüp veriyi kirletmesin.
 */
const CLARITY_PROJECT_ID = "y38g8fuokb";

const CLARITY_SNIPPET = `(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`;

export default function Clarity() {
  if (process.env.NODE_ENV === "development") return null;

  /**
   * `id` kesinlikle "clarity" olmamalı: tarayıcı, id'si olan elementleri aynı
   * adla `window` üzerine koyar (DOM clobbering). O durumda snippet'teki
   * `c[a] = c[a] || function(){...}` satırı script elementini "zaten var" kabul
   * edip Clarity'nin kuyruk fonksiyonunu hiç oluşturmuyor ve kütüphane
   * yüklenince `a[c] is not a function` hatası veriyor.
   *
   * `afterInteractive`: sayfa etkileşime hazır olduktan sonra yüklenir, ilk
   * boyamayı ve editörün açılışını geciktirmez.
   */
  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {CLARITY_SNIPPET}
    </Script>
  );
}
