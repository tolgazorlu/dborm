import type { DocumentInput, LegalDocument } from "./types";

export function privacyDocument(input: DocumentInput, locale: "tr" | "en"): LegalDocument {
  return locale === "tr" ? turkish(input) : english(input);
}

function turkish(input: DocumentInput): LegalDocument {
  const blocks: LegalDocument["blocks"] = [
    {
      type: "p",
      text: `ORMLens, ORM şema kodunu diyagrama çeviren ve inceleyen bir araçtır. Bu sunucuyu ${input.operatorName} işletmektedir. Bu metin, sunucunun hangi verileri işlediğini açıklar.`,
    },
    { type: "h2", text: "Kısaca" },
    {
      type: "ul",
      items: [
        "Hesap oluşturmadan kullanabildiğiniz durumlarda kimliğinizi tespit eden bir veri toplanmaz.",
        "Editöre yazdığınız şema kodu tarayıcınızda saklanır; sunucuya yalnızca ayrıştırma ve analiz sırasında gider ve orada saklanmaz.",
        "Yapay zeka analizini siz başlatmadan hiçbir içerik üçüncü tarafa gönderilmez.",
        "IP adresiniz ham hâliyle saklanmaz; yalnızca istek sınırlaması için tuzlanmış özeti bellekte tutulur.",
      ],
    },
    { type: "h2", text: "İşlenen veriler ve amaçları" },
    {
      type: "table",
      head: ["Veri", "Amaç", "Saklama"],
      rows: [
        [
          "Şema kaynak kodu (istek gövdesi)",
          "Ayrıştırma, diyagram üretimi ve kural motoru kontrolleri",
          "Sunucuda saklanmaz; istek bitince bellekten düşer",
        ],
        [
          "Şema kaynak kodu (tarayıcı)",
          "Çalışmanızın sekme kapansa bile kaybolmaması",
          "Tarayıcınızın localStorage alanında, siz silene kadar",
        ],
        [
          "Ayrıştırılmış şema özeti",
          "Yapay zeka analizi (yalnızca düğmeye bastığınızda)",
          "Sunucuda saklanmaz; sağlayıcının politikasına tabidir",
        ],
        [
          "Paylaşım linki içeriği",
          "Tek kullanımlık link ile şema paylaşımı",
          "En fazla 24 saat; link açıldığı anda silinir",
        ],
        [
          "IP adresinin tuzlanmış özeti",
          "İstek sınırlaması, kötüye kullanım ve maliyet kontrolü",
          "Yalnızca bellekte, ilgili sayaç penceresi boyunca",
        ],
        [
          "Dil ve tema tercihi",
          "Arayüzü doğru dilde ve temada göstermek",
          "Çerez ve localStorage; siz değiştirene kadar",
        ],
      ],
    },
  ];

  if (input.authEnabled) {
    blocks.push(
      { type: "h3", text: "Hesap bilgileri" },
      {
        type: "p",
        text: "Bu sunucu giriş gerektirecek şekilde yapılandırılmıştır. E-posta adresiniz ve şifrenizin geri döndürülemez özeti (scrypt) sunucuda saklanır. Şifrenin kendisi hiçbir zaman saklanmaz. Oturum kaydı, çıkış yapana veya oturum süresi dolana kadar tutulur.",
      },
    );
  }

  if (input.analyticsEnabled) {
    blocks.push(
      { type: "h3", text: "Analitik" },
      {
        type: "p",
        text: "Bu sunucuda Microsoft Clarity kullanılmaktadır ve yalnızca çerez onayı verdiğinizde yüklenir. Clarity; sayfa adresleri, tıklama ve kaydırma hareketleri gibi kullanım verilerini toplar. Paylaşım linki sayfalarında (/s/...) bilinçli olarak hiç yüklenmez, çünkü adres çubuğundaki token analitiğe düşmemelidir. Ayrıntı için Çerez Politikası'na bakın.",
      },
    );
  }

  blocks.push(
    { type: "h2", text: "Yapay zeka analizi ve yurt dışına aktarım" },
    {
      type: "p",
      text: `"Yapay zeka ile analiz et" düğmesine bastığınızda, ayrıştırılmış şema özeti (tablo, kolon ve ilişki adları ile tipleri) ${input.aiProvider} servisine gönderilir. Bu servis yurt dışında bulunan sunucular üzerinde çalışabilir; dolayısıyla söz konusu içerik yurt dışına aktarılmış olur. Ham kaynak kodunuz değil, ayrıştırılmış özet gönderilir. Şemanızda gerçek kişisel veri ya da sır bulunmamalıdır — şema tanımları veri modelinizi anlatır, veri satırlarınızı değil.`,
    },
    { type: "h2", text: "Barındırma ve altyapı" },
    {
      type: "p",
      text: "Uygulamanın çalıştığı sunucu ve önündeki ağ katmanı, olağan işletim kayıtları (erişim logları) tutabilir. Bu kayıtlar uygulamanın kendi veri işleyişinin dışındadır ve ilgili altyapı sağlayıcısının politikasına tabidir.",
    },
    { type: "h2", text: "Hukuki dayanak" },
    {
      type: "ul",
      items: [
        "Hizmetin sunulması: sözleşmenin kurulması ve ifası ile meşru menfaat (KVKK md. 5/2-c ve 5/2-f; GDPR md. 6/1-b ve 6/1-f).",
        "Güvenlik, kötüye kullanımın ve maliyet suistimalinin önlenmesi: meşru menfaat (KVKK md. 5/2-f; GDPR md. 6/1-f).",
        "Analitik çerezler: açık rıza (KVKK md. 5/1; GDPR md. 6/1-a).",
      ],
    },
    { type: "h2", text: "Haklarınız" },
    {
      type: "p",
      text: "KVKK md. 11 ve GDPR md. 15-22 kapsamındaki haklarınızı kullanmak için aşağıdaki iletişim adresine yazabilirsiniz. Bu haklar; verilerinize erişme, düzeltilmesini veya silinmesini isteme, işlenmesine itiraz etme ve rızanızı geri çekme haklarını kapsar. Ayrıntılı liste KVKK Aydınlatma Metni'nde yer alır.",
    },
    { type: "h2", text: "Çocuklar" },
    {
      type: "p",
      text: "Bu araç geliştiricilere yöneliktir ve 13 yaşın altındaki kişilere yönelik değildir.",
    },
    { type: "h2", text: "İletişim" },
    { type: "p", text: `${input.operatorName} — ${input.contact}${input.address ? ` — ${input.address}` : ""}` },
    { type: "h2", text: "Değişiklikler" },
    {
      type: "p",
      text: "Bu metin güncellendiğinde sayfanın üstündeki tarih değişir. Önemli değişikliklerde uygulama içinde ayrıca bilgilendirme yapılır.",
    },
  );

  return { title: "Gizlilik Politikası", blocks };
}

function english(input: DocumentInput): LegalDocument {
  const blocks: LegalDocument["blocks"] = [
    {
      type: "p",
      text: `ORMLens is a tool that turns ORM schema code into a diagram and reviews it. This server is operated by ${input.operatorName}. This document explains what data the server processes.`,
    },
    { type: "h2", text: "In short" },
    {
      type: "ul",
      items: [
        "Where the app is usable without an account, no data that identifies you is collected.",
        "The schema code you type is stored in your browser. It reaches the server only for parsing and analysis, and is not stored there.",
        "No content is sent to a third party unless you start the AI analysis yourself.",
        "Your IP address is never stored raw; only a salted digest is kept in memory for rate limiting.",
      ],
    },
    { type: "h2", text: "Data processed and why" },
    {
      type: "table",
      head: ["Data", "Purpose", "Retention"],
      rows: [
        [
          "Schema source code (request body)",
          "Parsing, diagram generation and rule engine checks",
          "Not stored on the server; released from memory when the request ends",
        ],
        [
          "Schema source code (browser)",
          "So your work survives closing the tab",
          "In your browser's localStorage until you clear it",
        ],
        [
          "Parsed schema digest",
          "AI analysis, only when you press the button",
          "Not stored on the server; subject to the provider's policy",
        ],
        [
          "Share link content",
          "Sharing a schema through a one-time link",
          "At most 24 hours; deleted the moment the link is opened",
        ],
        [
          "Salted digest of the IP address",
          "Rate limiting, abuse and cost control",
          "In memory only, for the length of the counter window",
        ],
        [
          "Locale and theme preference",
          "Rendering the interface in the right language and theme",
          "Cookie and localStorage, until you change it",
        ],
      ],
    },
  ];

  if (input.authEnabled) {
    blocks.push(
      { type: "h3", text: "Account data" },
      {
        type: "p",
        text: "This server is configured to require a sign-in. Your email address and an irreversible digest of your password (scrypt) are stored on the server. The password itself is never stored. A session record is kept until you sign out or the session expires.",
      },
    );
  }

  if (input.analyticsEnabled) {
    blocks.push(
      { type: "h3", text: "Analytics" },
      {
        type: "p",
        text: "This server uses Microsoft Clarity, and it loads only if you accept cookies. Clarity collects usage data such as page addresses, clicks and scrolling. It is deliberately never loaded on share link pages (/s/...), because the token in the address bar must not reach analytics. See the Cookie Policy for details.",
      },
    );
  }

  blocks.push(
    { type: "h2", text: "AI analysis and international transfer" },
    {
      type: "p",
      text: `When you press "Analyze with AI", the parsed schema digest — table, column and relation names and their types — is sent to ${input.aiProvider}. That service may run on servers outside your country, so the content is transferred internationally. Your raw source code is not sent, only the parsed digest. Your schema should not contain real personal data or secrets: schema definitions describe your data model, not your data rows.`,
    },
    { type: "h2", text: "Hosting and infrastructure" },
    {
      type: "p",
      text: "The server the app runs on, and the network layer in front of it, may keep ordinary operational records such as access logs. Those records sit outside the application's own data handling and are subject to the infrastructure provider's policy.",
    },
    { type: "h2", text: "Legal bases" },
    {
      type: "ul",
      items: [
        "Providing the service: performance of a contract and legitimate interest (GDPR art. 6(1)(b) and 6(1)(f); KVKK art. 5/2-c and 5/2-f).",
        "Security, abuse prevention and cost control: legitimate interest (GDPR art. 6(1)(f); KVKK art. 5/2-f).",
        "Analytics cookies: explicit consent (GDPR art. 6(1)(a); KVKK art. 5/1).",
      ],
    },
    { type: "h2", text: "Your rights" },
    {
      type: "p",
      text: "To exercise your rights under GDPR arts. 15-22 and KVKK art. 11, write to the contact address below. These include the right to access your data, to have it corrected or deleted, to object to processing and to withdraw consent. The detailed list is in the KVKK Disclosure.",
    },
    { type: "h2", text: "Children" },
    {
      type: "p",
      text: "This tool is aimed at developers and is not directed at anyone under 13.",
    },
    { type: "h2", text: "Contact" },
    { type: "p", text: `${input.operatorName} — ${input.contact}${input.address ? ` — ${input.address}` : ""}` },
    { type: "h2", text: "Changes" },
    {
      type: "p",
      text: "When this document is updated, the date at the top of the page changes. Significant changes are also announced inside the app.",
    },
  );

  return { title: "Privacy Policy", blocks };
}
