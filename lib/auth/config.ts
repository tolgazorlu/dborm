export const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

export const SESSION_COOKIE = "ormlens_session";
export const SECURE_SESSION_COOKIE = "__Host-ormlens_session";

const DEFAULT_TTL_HOURS = 168;

export function sessionTtlMs(): number {
  const raw = Number(process.env.AUTH_SESSION_TTL_HOURS);
  const hours = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}

export function setupToken(): string | null {
  const value = process.env.AUTH_SETUP_TOKEN?.trim();
  return value ? value : null;
}

export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
