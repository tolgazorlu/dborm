import { createHash, randomBytes } from "node:crypto";

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitVerdict;
}

interface Counter {
  count: number;
  resetAt: number;
}

const MAX_KEYS_PER_BUCKET = 20_000;

const REGISTRY = Symbol.for("dborm.rate-limit.registry");

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

const IP_SALT = process.env.RATE_LIMIT_SALT ?? randomBytes(16).toString("hex");

const IP_HEADER = process.env.RATE_LIMIT_IP_HEADER;

export function clientKey(request: Request): string {
  const ip = IP_HEADER
    ? request.headers.get(IP_HEADER)?.split(",")[0]?.trim()
    : request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim();

  return createHash("sha256")
    .update(IP_SALT)
    .update(ip || "unknown")
    .digest("base64url")
    .slice(0, 24);
}
