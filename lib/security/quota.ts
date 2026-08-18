import { createRateLimiter, type RateLimitVerdict } from "./rate-limit";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

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

const parseLimiter = createRateLimiter("parse", {
  limit: envInt("PARSE_RATE_LIMIT", 120),
  windowMs: MINUTE,
});

const shareCreateLimiter = createRateLimiter("share:create", {
  limit: envInt("SHARE_RATE_LIMIT", 20),
  windowMs: HOUR,
});

const shareOpenLimiter = createRateLimiter("share:open", {
  limit: envInt("SHARE_OPEN_RATE_LIMIT", 60),
  windowMs: HOUR,
});

const authLimiter = createRateLimiter("auth", {
  limit: envInt("AUTH_RATE_LIMIT", 10),
  windowMs: 15 * MINUTE,
});

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

export function checkAuthQuota(key: string): RateLimitVerdict | null {
  return rejection(authLimiter.check(key));
}

function rejection(verdict: RateLimitVerdict): RateLimitVerdict | null {
  return verdict.allowed ? null : verdict;
}

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
