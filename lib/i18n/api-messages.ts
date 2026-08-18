import type { Locale } from "./locales";

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
    notFound: string;
    badOrigin: string;
    unauthorized: string;
    invalidCredentials: string;
    invalidEmail: string;
    weakPassword: (minLength: number) => string;
    invalidSetupToken: string;
    setupClosed: string;
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
    notFound: "Bulunamadı.",
    badOrigin: "İstek kaynağı doğrulanamadı.",
    unauthorized: "Bu işlem için giriş yapmanız gerekiyor.",
    invalidCredentials: "E-posta veya şifre hatalı.",
    invalidEmail: "Geçerli bir e-posta adresi girin.",
    weakPassword: (minLength) => `Şifre en az ${minLength} karakter olmalı.`,
    invalidSetupToken: "Kurulum anahtarı hatalı.",
    setupClosed: "Bu sunucuda hesap zaten oluşturulmuş.",
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
    notFound: "Not found.",
    badOrigin: "The request origin could not be verified.",
    unauthorized: "You need to sign in for this action.",
    invalidCredentials: "Incorrect email or password.",
    invalidEmail: "Enter a valid email address.",
    weakPassword: (minLength) => `The password must be at least ${minLength} characters.`,
    invalidSetupToken: "Incorrect setup key.",
    setupClosed: "An account has already been created on this server.",
  },
};
