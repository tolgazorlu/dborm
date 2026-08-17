import { createHash, randomBytes } from "node:crypto";

/**
 * Sabit pencereli (fixed window) istek sayacı.
 *
 * Depolama süreç belleğinde: harici bir bağımlılık (Redis/KV) getirmeden
 * çalışsın diye — `lib/share/store.ts` ile aynı tercih. Tek süreçli bir
 * sunucuda (`next start`, Docker, tek bir VM) doğru çalışır. Serverless'ta her
 * örnek kendi sayacını tuttuğu için gerçekleşen limit "örnek sayısı × limit"
 * olur; çok örnekli üretimde bu modülü Upstash/Redis ile değiştirin —
 * `createRateLimiter` arayüzü aynı kalabilir.
 *
 * Pencereler duvar saatine hizalı, kayan değil: 24 saatlik pencere UTC gece
 * yarısında sıfırlanır. "Günlük limit" ifadesinin doğru olması için gerekli;
 * kayan pencerede sıfırlanma anı her kullanıcı için farklı olurdu.
 */

export interface RateLimitPolicy {
  /** Bir pencerede izin verilen istek sayısı. */
  limit: number;
  /** Pencere uzunluğu (ms). */
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Pencerenin sıfırlanacağı an (epoch ms). */
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Sayacı bir artırır ve sonucu döner. */
  check(key: string): RateLimitVerdict;
}

interface Counter {
  count: number;
  resetAt: number;
}

/**
 * Bellek sınırı: sayaç haritası saldırgan tarafından şişirilebilecek tek yer.
 * Eşiği aşınca önce süresi dolmuşlar atılır, hâlâ doluysa harita tamamen
 * boşaltılır. Bilinçli olarak "fail-open": limitleyici bellek tüketerek
 * sunucuyu düşürmektense o an bir pencereyi affeder.
 */
const MAX_KEYS_PER_BUCKET = 20_000;

/**
 * Sayaçlar `globalThis` üzerinde: geliştirme sırasında modüller hot reload ile
 * yeniden değerlendiriliyor ve modül seviyesindeki bir `Map` her kayıtta
 * sıfırlanırdı.
 */
const REGISTRY = Symbol.for("ormlens.rate-limit.registry");

type Registry = Map<string, Map<string, Counter>>;

function bucketFor(name: string): Map<string, Counter> {
  const holder = globalThis as typeof globalThis & { [REGISTRY]?: Registry };
  const registry = (holder[REGISTRY] ??= new Map());

  let bucket = registry.get(name);
  if (!bucket) {
    bucket = new Map();
    registry.set(name, bucket);
  }
  return bucket;
}

export function createRateLimiter(name: string, policy: RateLimitPolicy): RateLimiter {
  const { limit, windowMs } = policy;

  return {
    check(key: string): RateLimitVerdict {
      const bucket = bucketFor(name);
      const now = Date.now();
      const existing = bucket.get(key);

      if (!existing || existing.resetAt <= now) {
        if (bucket.size >= MAX_KEYS_PER_BUCKET) sweep(bucket, now);
        const resetAt = Math.floor(now / windowMs) * windowMs + windowMs;
        bucket.set(key, { count: 1, resetAt });
        return verdict(true, limit, limit - 1, resetAt, now);
      }

      if (existing.count >= limit) {
        return verdict(false, limit, 0, existing.resetAt, now);
      }

      existing.count += 1;
      return verdict(true, limit, limit - existing.count, existing.resetAt, now);
    },
  };
}

function verdict(
  allowed: boolean,
  limit: number,
  remaining: number,
  resetAt: number,
  now: number,
): RateLimitVerdict {
  return {
    allowed,
    limit,
    remaining,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

function sweep(bucket: Map<string, Counter>, now: number): void {
  for (const [key, counter] of bucket) {
    if (counter.resetAt <= now) bucket.delete(key);
  }
  if (bucket.size >= MAX_KEYS_PER_BUCKET) bucket.clear();
}

/**
 * IP tuz + SHA-256 ile karılıyor.
 *
 * Sayaç için IP'nin kendisi hiç gerekmiyor, yalnızca "aynı istemci mi?"
 * eşitliği gerekiyor. Ham IP kişisel veridir (KVKK/GDPR); tutmamak en temizi.
 * Tuz verilmezse süreç başına rastgele üretilir — yeniden başlatmada anahtarlar
 * değişir, bu da sayaçların sıfırlanmasıyla zaten aynı anlama gelir.
 *
 * `x-forwarded-for`'un ilk girdisi istemcidir; bu başlığı ters vekil (Vercel,
 * nginx, Cloudflare) yazar. Uygulamayı vekilsiz doğrudan internete açarsanız
 * başlık istemci tarafından uydurulabilir — o senaryoda limitleyici
 * atlatılabilir, önüne bir vekil koyun.
 */
const IP_SALT = process.env.RATE_LIMIT_SALT ?? randomBytes(16).toString("hex");

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";

  return createHash("sha256").update(IP_SALT).update(ip).digest("base64url").slice(0, 24);
}
