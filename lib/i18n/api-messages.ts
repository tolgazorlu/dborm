import type { Locale } from "./locales";

/** Route handler'ların döndüğü, kullanıcıya gösterilen hata metinleri. */
export const API_MESSAGES: Record<
  Locale,
  {
    invalidJson: string;
    schemaRequired: string;
    tooLarge: (limitKb: number) => string;
    noTables: string;
    missingApiKey: string;
    linkGone: string;
    aiLimit: string;
    tooManyRequests: string;
  }
> = {
  tr: {
    invalidJson: "Geçersiz JSON gövdesi.",
    schemaRequired: "Şema içeriği zorunlu.",
    tooLarge: (limitKb) => `Girdi çok büyük (limit ${limitKb} KB).`,
    noTables: "Ayrıştırılabilir tablo bulunamadı. Şemayı kontrol edin.",
    missingApiKey:
      "GOOGLE_GENERATIVE_AI_API_KEY tanımlı değil. `.env.local` dosyasına ekleyip sunucuyu yeniden başlatın.",
    linkGone: "Bu link daha önce kullanılmış ya da süresi dolmuş.",
    aiLimit:
      "Günlük yapay zekâ analiz limiti doldu. Lütfen daha sonra tekrar deneyin — kural motoru ve diyagram çalışmaya devam ediyor.",
    tooManyRequests: "Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.",
  },
  en: {
    invalidJson: "Invalid JSON body.",
    schemaRequired: "Schema content is required.",
    tooLarge: (limitKb) => `Input too large (limit ${limitKb} KB).`,
    noTables: "No parsable tables found. Check the schema.",
    missingApiKey:
      "GOOGLE_GENERATIVE_AI_API_KEY is not set. Add it to `.env.local` and restart the server.",
    linkGone: "This link has already been used or has expired.",
    aiLimit:
      "The daily AI analysis limit has been reached. Please try again later — the rule engine and the diagram keep working.",
    tooManyRequests: "Too many requests. Please wait a moment and try again.",
  },
};
