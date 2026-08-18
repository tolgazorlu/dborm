import type { DocumentInput, LegalDocument } from "./types";

export function cookieDocument(input: DocumentInput, locale: "tr" | "en"): LegalDocument {
  return locale === "tr" ? turkish(input) : english(input);
}

function turkish(input: DocumentInput): LegalDocument {
  const strictlyNecessary: string[][] = [
    ["locale", "Çerez", "Arayüz dilini sunucunun da bilmesi için. Olmazsa sayfa yanlış dilde açılır.", "1 yıl"],
  ];
  if (input.authEnabled) {
    strictlyNecessary.push([
      "ormlens_session",
      "Çerez",
      "Giriş yapmış oturumunuzu tanımak için. HttpOnly ve SameSite=Lax olarak ayarlanır.",
      "Varsayılan 7 gün",
    ]);
  }

  const localStorage: string[][] = [
    ["theme", "localStorage", "Koyu/açık tema tercihi.", "Siz silene kadar"],
    ["ormlens:workspace:v1", "localStorage", "Editördeki şema kodunuz. Tarayıcınızdan çıkmaz.", "Siz silene kadar"],
  ];
  if (input.analyticsEnabled) {
    localStorage.push([
      "ormlens:cookie-consent",
      "localStorage",
      "Analitik çerezlere verdiğiniz yanıt.",
      "Siz silene kadar",
    ]);
  }

  const blocks: LegalDocument["blocks"] = [
    {
      type: "p",
      text: "Bu metin, ORMLens'in tarayıcınızda hangi verileri sakladığını açıklar. Aşağıdaki tablolar bu sunucunun yapılandırmasına göre oluşturulmuştur.",
    },
    { type: "h2", text: "Zorunlu çerezler" },
    {
      type: "p",
      text: "Bu çerezler uygulamanın çalışması için gereklidir ve onay gerektirmez.",
    },
    { type: "table", head: ["Ad", "Tür", "Amaç", "Süre"], rows: strictlyNecessary },
    { type: "h2", text: "Tarayıcı deposu (çerez değil)" },
    {
      type: "p",
      text: "Aşağıdaki kayıtlar localStorage'da tutulur ve sunucuya hiçbir zaman gönderilmez. Çerezlerden farkı budur: her istekte ağ üzerinden gitmezler.",
    },
    { type: "table", head: ["Ad", "Tür", "Amaç", "Süre"], rows: localStorage },
  ];

  if (input.analyticsEnabled) {
    blocks.push(
      { type: "h2", text: "Analitik çerezler" },
      {
        type: "p",
        text: "Bu sunucuda Microsoft Clarity kullanılmaktadır. Clarity yalnızca çerez bildiriminde kabul ederseniz yüklenir; reddederseniz hiçbir analitik script sayfaya eklenmez. Clarity, kendi alan adı üzerinden çerez yerleştirir ve sayfa adresleri, tıklama ve kaydırma gibi kullanım verilerini toplar.",
      },
      {
        type: "p",
        text: "Paylaşım linki sayfalarında (/s/...) Clarity bilinçli olarak hiç yüklenmez: linkin token'ı adres çubuğundadır ve analitik hizmetine gitmemelidir.",
      },
      {
        type: "p",
        text: "Kararınızı değiştirmek isterseniz tarayıcınızın site verilerini temizleyin; çerez bildirimi yeniden gösterilir.",
      },
    );
  } else {
    blocks.push(
      { type: "h2", text: "Analitik çerezler" },
      { type: "p", text: "Bu sunucuda analitik veya reklam çerezi kullanılmamaktadır." },
    );
  }

  blocks.push(
    { type: "h2", text: "Çerezleri yönetmek" },
    {
      type: "p",
      text: "Tüm çerezleri tarayıcı ayarlarınızdan silebilir veya engelleyebilirsiniz. Zorunlu çerezleri engellerseniz dil tercihiniz hatırlanmaz ve giriş gerektiren sunucularda oturum açamazsınız.",
    },
    { type: "h2", text: "İletişim" },
    { type: "p", text: `${input.operatorName} — ${input.contact}` },
  );

  return { title: "Çerez Politikası", blocks };
}

function english(input: DocumentInput): LegalDocument {
  const strictlyNecessary: string[][] = [
    ["locale", "Cookie", "So the server also knows the interface language. Without it the page opens in the wrong language.", "1 year"],
  ];
  if (input.authEnabled) {
    strictlyNecessary.push([
      "ormlens_session",
      "Cookie",
      "Identifies your signed-in session. Set as HttpOnly with SameSite=Lax.",
      "7 days by default",
    ]);
  }

  const localStorage: string[][] = [
    ["theme", "localStorage", "Dark/light theme preference.", "Until you clear it"],
    ["ormlens:workspace:v1", "localStorage", "Your schema code in the editor. It never leaves your browser.", "Until you clear it"],
  ];
  if (input.analyticsEnabled) {
    localStorage.push([
      "ormlens:cookie-consent",
      "localStorage",
      "Your answer to the analytics cookie prompt.",
      "Until you clear it",
    ]);
  }

  const blocks: LegalDocument["blocks"] = [
    {
      type: "p",
      text: "This document explains what ORMLens stores in your browser. The tables below are generated from this server's configuration.",
    },
    { type: "h2", text: "Strictly necessary cookies" },
    { type: "p", text: "These are required for the app to work and do not need consent." },
    { type: "table", head: ["Name", "Type", "Purpose", "Duration"], rows: strictlyNecessary },
    { type: "h2", text: "Browser storage (not cookies)" },
    {
      type: "p",
      text: "The entries below live in localStorage and are never sent to the server. That is the difference from a cookie: they do not travel over the network on every request.",
    },
    { type: "table", head: ["Name", "Type", "Purpose", "Duration"], rows: localStorage },
  ];

  if (input.analyticsEnabled) {
    blocks.push(
      { type: "h2", text: "Analytics cookies" },
      {
        type: "p",
        text: "This server uses Microsoft Clarity. Clarity loads only if you accept in the cookie notice; if you decline, no analytics script is added to the page at all. Clarity sets cookies on its own domain and collects usage data such as page addresses, clicks and scrolling.",
      },
      {
        type: "p",
        text: "Clarity is deliberately never loaded on share link pages (/s/...): the link token is in the address bar and must not reach an analytics service.",
      },
      {
        type: "p",
        text: "To change your decision, clear this site's data in your browser and the cookie notice will appear again.",
      },
    );
  } else {
    blocks.push(
      { type: "h2", text: "Analytics cookies" },
      { type: "p", text: "This server uses no analytics or advertising cookies." },
    );
  }

  blocks.push(
    { type: "h2", text: "Managing cookies" },
    {
      type: "p",
      text: "You can delete or block all cookies from your browser settings. Blocking the strictly necessary ones means your language preference is not remembered, and on servers that require a sign-in you will not be able to log in.",
    },
    { type: "h2", text: "Contact" },
    { type: "p", text: `${input.operatorName} — ${input.contact}` },
  );

  return { title: "Cookie Policy", blocks };
}
