import { createRateLimiter, type RateLimitVerdict } from "./rate-limit";

/**
 * Uç noktaların kota politikaları tek yerde.
 *
 * Uygulama herkese açık ve AI çağrısı doğrudan paralı bir dış kotayı harcıyor;
 * limitler bu yüzden "kötü niyetliyi durdur" değil, "faturayı ve API kotasını
 * koru" amaçlı. Sayılar ortam değişkeniyle değiştirilebilir ki dağıtım başına
 * ayar için kodu düzenlemek gerekmesin.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/**
 * AI için üç katman:
 * - **burst**: tek kullanıcının düğmeye asılmasını engeller.
 * - **daily**: kişi başı günlük pay.
 * - **global**: tüm kullanıcıların toplamı. Asıl fren bu — tek bir kişi
 *   limitini aşmasa da yüzlerce kişi aynı gün gelirse fatura patlar.
 */
const aiBurst = createRateLimiter("ai:burst", {
  limit: envInt("AI_BURST_LIMIT", 3),
  windowMs: MINUTE,
});
const aiDaily = createRateLimiter("ai:daily", {
  limit: envInt("AI_DAILY_LIMIT", 15),
  windowMs: DAY,
});
const aiGlobalDaily = createRateLimiter("ai:global-daily", {
  limit: envInt("AI_GLOBAL_DAILY_LIMIT", 400),
  windowMs: DAY,
});

/**
 * Ayrıştırma ucuz değil: ts-morph her istekte TypeScript derleyicisini
 * çalıştırıyor. Editör 400 ms debounce ile çağırdığı için insan kullanımı bu
 * limitin çok altında kalır.
 */
const parseLimiter = createRateLimiter("parse", {
  limit: envInt("PARSE_RATE_LIMIT", 120),
  windowMs: MINUTE,
});

/** Paylaşım kaydı diske yazıyor; sınırsız olsa diski doldurmak bedava olurdu. */
const shareCreateLimiter = createRateLimiter("share:create", {
  limit: envInt("SHARE_RATE_LIMIT", 20),
  windowMs: HOUR,
});

/** Token 192 bit rastgele; bu limit deneme-yanılmayı değil, gürültüyü keser. */
const shareOpenLimiter = createRateLimiter("share:open", {
  limit: envInt("SHARE_OPEN_RATE_LIMIT", 60),
  windowMs: HOUR,
});

/**
 * Katmanları **sırayla** deniyoruz: ilki reddederse sonrakiler hiç harcanmaz.
 * Sıralama önemli — global sayaç en sonda ki, kendi payını çoktan doldurmuş
 * bir istemci herkesin ortak kotasından da yemesin.
 */
export function checkAiQuota(key: string): RateLimitVerdict | null {
  for (const verdict of [
    () => aiBurst.check(key),
    () => aiDaily.check(key),
    () => aiGlobalDaily.check("all"),
  ]) {
    const result = verdict();
    if (!result.allowed) return result;
  }
  return null;
}

export function checkParseQuota(key: string): RateLimitVerdict | null {
  return rejection(parseLimiter.check(key));
}

export function checkShareCreateQuota(key: string): RateLimitVerdict | null {
  return rejection(shareCreateLimiter.check(key));
}

export function checkShareOpenQuota(key: string): RateLimitVerdict | null {
  return rejection(shareOpenLimiter.check(key));
}

function rejection(verdict: RateLimitVerdict): RateLimitVerdict | null {
  return verdict.allowed ? null : verdict;
}

/**
 * 429 yanıtı. `Retry-After` standart başlık; tarayıcı göstermez ama otomatik
 * istemciler ve tarayıcı geliştirici araçları için doğru sinyal.
 */
export function tooManyRequests(message: string, verdict: RateLimitVerdict): Response {
  return Response.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(verdict.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}
