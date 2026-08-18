import type { DocumentInput, LegalDocument } from "./types";

export function kvkkDocument(input: DocumentInput, locale: "tr" | "en"): LegalDocument {
  return locale === "tr" ? turkish(input) : english(input);
}

const RIGHTS_TR = [
  "Kişisel verilerinizin işlenip işlenmediğini öğrenme.",
  "Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme.",
  "İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme.",
  "Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme.",
  "Eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme.",
  "KVKK md. 7'de öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme.",
  "Düzeltme, silme ve yok edilme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme.",
  "Münhasıran otomatik sistemler ile analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme.",
  "Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme.",
];

const RIGHTS_EN = [
  "Learn whether your personal data is being processed.",
  "Request information if your personal data has been processed.",
  "Learn the purpose of processing and whether the data is used in line with that purpose.",
  "Know the third parties, domestic or abroad, that the data is transferred to.",
  "Request correction if the data is incomplete or inaccurate.",
  "Request erasure or destruction under the conditions in KVKK art. 7.",
  "Request that corrections, erasures and destructions be notified to the third parties the data was transferred to.",
  "Object to a result reached against you solely through automated analysis.",
  "Claim compensation if you suffer damage due to unlawful processing.",
];

function turkish(input: DocumentInput): LegalDocument {
  const blocks: LegalDocument["blocks"] = [
    {
      type: "p",
      text: `Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun ("KVKK") 10. maddesi uyarınca hazırlanmış aydınlatma metnidir.`,
    },
    { type: "h2", text: "Veri sorumlusu" },
    {
      type: "p",
      text: `Veri sorumlusu ${input.operatorName}'dir. İletişim: ${input.contact}${input.address ? `, ${input.address}` : ""}.`,
    },
    { type: "h2", text: "İşlenen kişisel veriler" },
    {
      type: "p",
      text: "dbORM, kimlik doğrulaması kapalıyken sizden ad, soyad, telefon gibi kimlik bilgisi istemez. Bu kapsamda işlenen veriler şunlardır:",
    },
    {
      type: "ul",
      items: [
        "İşlem güvenliği bilgisi: IP adresinizin tuzlanmış özeti (ham IP saklanmaz), istek zamanı ve sayısı.",
        "Kullanıcı içeriği: editöre yazdığınız şema kaynak kodu ve paylaşım linki oluşturursanız bu içeriğin kopyası.",
        "Tercihler: dil ve tema seçiminiz.",
        ...(input.authEnabled
          ? ["Kimlik ve iletişim bilgisi: hesap e-posta adresiniz ve şifrenizin geri döndürülemez özeti."]
          : []),
        ...(input.analyticsEnabled
          ? ["Kullanım verisi: onay vermeniz hâlinde analitik aracının topladığı gezinme ve etkileşim kayıtları."]
          : []),
      ],
    },
    { type: "h2", text: "İşleme amaçları" },
    {
      type: "ul",
      items: [
        "Şema kodunun ayrıştırılması, diyagrama çevrilmesi ve kural motoru ile denetlenmesi.",
        "Talep etmeniz hâlinde yapay zeka destekli analizin üretilmesi.",
        "Tek kullanımlık paylaşım linklerinin oluşturulması ve açılması.",
        "Hizmetin sürekliliği, güvenliği ve kötüye kullanımın önlenmesi.",
        ...(input.authEnabled ? ["Yetkisiz erişimin engellenmesi ve oturum yönetimi."] : []),
        ...(input.analyticsEnabled ? ["Açık rızanıza bağlı olarak kullanım istatistiklerinin ölçülmesi."] : []),
      ],
    },
    { type: "h2", text: "Hukuki sebepler" },
    {
      type: "ul",
      items: [
        "KVKK md. 5/2-c: Sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması.",
        "KVKK md. 5/2-f: Veri sorumlusunun meşru menfaati (güvenlik, kötüye kullanımın önlenmesi, maliyet kontrolü).",
        "KVKK md. 5/1: Açık rıza (yalnızca analitik çerezler için).",
      ],
    },
    { type: "h2", text: "Toplama yöntemi" },
    {
      type: "p",
      text: "Veriler tamamen otomatik yollarla, uygulamayı kullanmanız sırasında tarayıcınız üzerinden elektronik ortamda toplanır.",
    },
    { type: "h2", text: "Aktarım ve yurt dışına aktarım" },
    {
      type: "p",
      text: `Yapay zeka analizini başlattığınızda, ayrıştırılmış şema özeti ${input.aiProvider} servisine aktarılır. Bu hizmet yurt dışındaki sunucular üzerinden verilebildiğinden aktarım KVKK md. 9 kapsamında yurt dışına aktarım niteliği taşır ve bu işlem yalnızca sizin başlattığınız talep üzerine gerçekleşir.`,
    },
    ...(input.analyticsEnabled
      ? [
          {
            type: "p" as const,
            text: "Analitik hizmeti Microsoft tarafından sağlanmaktadır ve açık rızanız hâlinde veriler yurt dışına aktarılabilir. Rızanızı çerez tercihlerinden dilediğiniz zaman geri çekebilirsiniz.",
          },
        ]
      : []),
    {
      type: "p",
      text: "Bunların dışında kişisel verileriniz üçüncü kişilerle paylaşılmaz; hukuken zorunlu hâller saklıdır.",
    },
    { type: "h2", text: "Saklama süreleri" },
    {
      type: "table",
      head: ["Veri", "Süre"],
      rows: [
        ["Şema kaynak kodu (sunucu)", "Saklanmaz; istek sonunda bellekten silinir"],
        ["Paylaşım linki içeriği", "En fazla 24 saat veya link açılana kadar"],
        ["IP özeti", "İlgili sayaç penceresi boyunca, yalnızca bellekte"],
        ...(input.authEnabled ? [["Oturum kaydı", "Çıkış yapılana veya oturum süresi dolana kadar"]] : []),
      ],
    },
    { type: "h2", text: "Haklarınız (KVKK md. 11)" },
    { type: "p", text: "Veri sorumlusuna başvurarak aşağıdaki haklarınızı kullanabilirsiniz:" },
    { type: "ul", items: RIGHTS_TR },
    {
      type: "p",
      text: `Taleplerinizi ${input.contact} adresine iletebilirsiniz. Başvurularınız KVKK md. 13 uyarınca en geç otuz gün içinde sonuçlandırılır. Talebiniz reddedilirse Kişisel Verileri Koruma Kurulu'na şikâyette bulunma hakkınız saklıdır.`,
    },
  ];

  return { title: "KVKK Aydınlatma Metni", blocks };
}

function english(input: DocumentInput): LegalDocument {
  const blocks: LegalDocument["blocks"] = [
    {
      type: "p",
      text: "This is the disclosure text required by article 10 of Turkish Personal Data Protection Law no. 6698 (KVKK). It is provided in English for convenience; the Turkish version is the operative one for KVKK purposes.",
    },
    { type: "h2", text: "Data controller" },
    {
      type: "p",
      text: `The data controller is ${input.operatorName}. Contact: ${input.contact}${input.address ? `, ${input.address}` : ""}.`,
    },
    { type: "h2", text: "Personal data processed" },
    {
      type: "p",
      text: "With authentication disabled, dbORM does not ask you for identity information such as a name or phone number. The data processed is:",
    },
    {
      type: "ul",
      items: [
        "Transaction security data: a salted digest of your IP address (the raw IP is not stored), request time and count.",
        "User content: the schema source code you type, and a copy of it if you create a share link.",
        "Preferences: your locale and theme choice.",
        ...(input.authEnabled
          ? ["Identity and contact data: your account email address and an irreversible digest of your password."]
          : []),
        ...(input.analyticsEnabled
          ? ["Usage data: navigation and interaction records collected by the analytics tool, if you consent."]
          : []),
      ],
    },
    { type: "h2", text: "Purposes of processing" },
    {
      type: "ul",
      items: [
        "Parsing the schema code, turning it into a diagram and checking it with the rule engine.",
        "Producing the AI-assisted analysis when you request it.",
        "Creating and opening one-time share links.",
        "Continuity and security of the service, and prevention of abuse.",
        ...(input.authEnabled ? ["Preventing unauthorised access and managing sessions."] : []),
        ...(input.analyticsEnabled ? ["Measuring usage statistics, subject to your explicit consent."] : []),
      ],
    },
    { type: "h2", text: "Legal grounds" },
    {
      type: "ul",
      items: [
        "KVKK art. 5/2-c: directly related to the conclusion or performance of a contract.",
        "KVKK art. 5/2-f: legitimate interest of the controller (security, abuse prevention, cost control).",
        "KVKK art. 5/1: explicit consent (analytics cookies only).",
      ],
    },
    { type: "h2", text: "Method of collection" },
    {
      type: "p",
      text: "Data is collected by fully automated means, electronically, through your browser as you use the application.",
    },
    { type: "h2", text: "Transfers, including abroad" },
    {
      type: "p",
      text: `When you start the AI analysis, the parsed schema digest is transferred to ${input.aiProvider}. Because that service may be delivered from servers abroad, this constitutes a transfer abroad under KVKK art. 9, and it only happens on a request you initiate.`,
    },
    ...(input.analyticsEnabled
      ? [
          {
            type: "p" as const,
            text: "The analytics service is provided by Microsoft, and with your explicit consent data may be transferred abroad. You can withdraw consent at any time from the cookie preferences.",
          },
        ]
      : []),
    {
      type: "p",
      text: "Beyond these, your personal data is not shared with third parties, except where legally required.",
    },
    { type: "h2", text: "Retention periods" },
    {
      type: "table",
      head: ["Data", "Period"],
      rows: [
        ["Schema source code (server)", "Not stored; released from memory when the request ends"],
        ["Share link content", "At most 24 hours, or until the link is opened"],
        ["IP digest", "For the length of the counter window, in memory only"],
        ...(input.authEnabled ? [["Session record", "Until sign-out or session expiry"]] : []),
      ],
    },
    { type: "h2", text: "Your rights (KVKK art. 11)" },
    { type: "p", text: "By applying to the data controller you may exercise the following rights:" },
    { type: "ul", items: RIGHTS_EN },
    {
      type: "p",
      text: `Send requests to ${input.contact}. Applications are concluded within thirty days at the latest under KVKK art. 13. If your request is refused, you retain the right to complain to the Turkish Personal Data Protection Board.`,
    },
  ];

  return { title: "KVKK Disclosure", blocks };
}
