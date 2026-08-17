import type { Locale } from "./locales";

/**
 * Arayüz metinleri.
 *
 * Anahtar dizisi (`t('a.b.c')`) yerine iç içe nesne kullanıyoruz: TypeScript
 * eksik/yanlış anahtarı derleme zamanında yakalıyor ve `en` sözlüğü `tr`'nin
 * şeklini birebir uygulamak zorunda kalıyor.
 *
 * Sunucuda üretilen metinler (parser teşhisleri, kural motoru bulguları, AI
 * prompt'u) burada değil, kendi modüllerinde yaşıyor — çünkü oraya locale
 * istekle birlikte gidiyor.
 */
const tr = {
  header: {
    tagline: "ORM şema görselleştirici",
    tables: (count: number) => `${count} tablo`,
    collections: (count: number) => `${count} koleksiyon`,
    relations: (count: number) => `${count} ilişki`,
    parsing: "ayrıştırılıyor…",
    syntaxErrors: (count: number) => `${count} sözdizimi hatası`,
    share: "Paylaş",
    editor: "Editör",
    panel: "Panel",
    horizontal: "Yatay",
    vertical: "Dikey",
    relayout: "Yeniden düzenle",
    reset: "Sıfırla",
    resetHint: "Kaydedilmiş şemayı silip örneklere döner.",
    theme: "Temayı değiştir",
    orm: "ORM",
    language: "Dil",
  },
  panel: {
    checks: (count: number) => `Kontroller (${count})`,
    ai: "AI analizi",
    parseSection: (count: number) => `Ayrıştırma (${count})`,
    rulesSection: (count: number) => `Kural motoru (${count})`,
    allClear: "Deterministik kontrollerden geçti — bilinen bir yapı hatası yok.",
  },
  ai: {
    analyze: "Yapay zeka ile analiz et",
    analyzing: "Analiz ediliyor…",
    stop: "Durdur",
    health: "Şema sağlığı",
    limitReached:
      "Günlük yapay zekâ analiz limiti doldu. Lütfen daha sonra tekrar deneyin — kural motoru ve diyagram çalışmaya devam ediyor.",
    empty:
      "Şemanızı model gözüyle değerlendirmek için yukarıdaki düğmeye basın. Eksik index, hatalı ilişki, performans ve güvenlik riskleri raporlanır.",
  },
  canvas: {
    emptyTitle: "Henüz çizilecek tablo yok.",
    emptyHint: "Soldaki editöre bir şema yapıştırın; diyagram yazdıkça güncellenir.",
  },
  editor: {
    loading: "Editör yükleniyor…",
  },
  severity: {
    critical: "kritik",
    high: "yüksek",
    medium: "orta",
    low: "düşük",
    info: "bilgi",
  },
  category: {
    index: "index",
    relation: "ilişki",
    performance: "performans",
    security: "güvenlik",
    naming: "adlandırma",
    "data-integrity": "veri bütünlüğü",
    scalability: "ölçeklenme",
  },
  share: {
    title: "Tek kullanımlık link",
    description: "Link bir kez açılabilir; açıldıktan sonra içerik sunucudan silinir.",
    once: "bir kez",
    creating: "Link oluşturuluyor…",
    copy: "Kopyala",
    copied: "Kopyalandı",
    close: "Kapat",
    expiresAt: (date: string) =>
      `Açılmazsa ${date} tarihinde kendiliğinden silinir. Linki kendiniz açmayın — karşı taraf açamaz.`,
    copyFailed: "Panoya kopyalanamadı; linki elle seçip kopyalayabilirsiniz.",
    failed: "Link oluşturulamadı.",
  },
  reveal: {
    title: "Tek kullanımlık şema linki",
    body: "Bu linkteki şema yalnızca bir kez açılabilir. Açtığınız anda sunucudan silinir; sayfayı yenilerseniz içerik bir daha gelmez.",
    onlyOnce: "yalnızca bir kez",
    expiresAt: (date: string) => `Açılmazsa ${date} tarihinde kendiliğinden silinir.`,
    open: "Şemayı aç ve linki geçersiz kıl",
    opening: "Açılıyor…",
    gone: "Bu link daha önce kullanılmış ya da süresi dolmuş. Tek kullanımlık linkler açıldıktan sonra kalıcı olarak silinir.",
    failed: "Link açılamadı.",
    start: "Kendi şemamla başla",
  },
};

// `as const` bilinçli olarak yok: literal tipler `en` sözlüğünü Türkçe
// metinlerin birebir aynısını yazmaya zorlardı. Şekil yine de zorunlu.
type Dictionary = typeof tr;

const en: Dictionary = {
  header: {
    tagline: "ORM schema visualizer",
    tables: (count: number) => `${count} table${count === 1 ? "" : "s"}`,
    collections: (count: number) => `${count} collection${count === 1 ? "" : "s"}`,
    relations: (count: number) => `${count} relation${count === 1 ? "" : "s"}`,
    parsing: "parsing…",
    syntaxErrors: (count: number) => `${count} syntax error${count === 1 ? "" : "s"}`,
    share: "Share",
    editor: "Editor",
    panel: "Panel",
    horizontal: "Horizontal",
    vertical: "Vertical",
    relayout: "Re-layout",
    reset: "Reset",
    resetHint: "Discards the saved schema and restores the samples.",
    theme: "Toggle theme",
    orm: "ORM",
    language: "Language",
  },
  panel: {
    checks: (count: number) => `Checks (${count})`,
    ai: "AI analysis",
    parseSection: (count: number) => `Parsing (${count})`,
    rulesSection: (count: number) => `Rule engine (${count})`,
    allClear: "Passed the deterministic checks — no known structural issues.",
  },
  ai: {
    analyze: "Analyze with AI",
    analyzing: "Analyzing…",
    stop: "Stop",
    health: "Schema health",
    limitReached:
      "The daily AI analysis limit has been reached. Please try again later — the rule engine and the diagram keep working.",
    empty:
      "Press the button above to have a model review your schema. It reports missing indexes, broken relations, performance and security risks.",
  },
  canvas: {
    emptyTitle: "Nothing to draw yet.",
    emptyHint: "Paste a schema into the editor on the left; the diagram updates as you type.",
  },
  editor: {
    loading: "Loading editor…",
  },
  severity: {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
    info: "info",
  },
  category: {
    index: "index",
    relation: "relation",
    performance: "performance",
    security: "security",
    naming: "naming",
    "data-integrity": "data integrity",
    scalability: "scalability",
  },
  share: {
    title: "One-time link",
    description: "The link can be opened once; the content is deleted from the server after that.",
    once: "once",
    creating: "Creating link…",
    copy: "Copy",
    copied: "Copied",
    close: "Close",
    expiresAt: (date: string) =>
      `If unopened, it self-destructs on ${date}. Don't open it yourself — the recipient then can't.`,
    copyFailed: "Could not copy to clipboard; select the link and copy it manually.",
    failed: "Could not create the link.",
  },
  reveal: {
    title: "One-time schema link",
    body: "The schema behind this link can be opened only once. It is deleted from the server the moment you open it; reloading the page will not bring it back.",
    onlyOnce: "only once",
    expiresAt: (date: string) => `If unopened, it self-destructs on ${date}.`,
    open: "Open the schema and burn the link",
    opening: "Opening…",
    gone: "This link has already been used or has expired. One-time links are permanently deleted once opened.",
    failed: "Could not open the link.",
    start: "Start with my own schema",
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { tr, en };
export type { Dictionary };
