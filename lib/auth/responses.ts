import { SECURE_SESSION_COOKIE, SESSION_COOKIE, isSecureRequest } from "./config";

export function sessionCookieName(request: Request): string {
  return isSecureRequest(request) ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
}

export function setSessionCookie(request: Request, token: string, expiresAt: number): string {
  const secure = isSecureRequest(request);
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

  return [
    `${sessionCookieName(request)}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookies(request: Request): string[] {
  const secure = isSecureRequest(request);
  const base = "Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
  return [
    `${SESSION_COOKIE}=; ${base}`,
    ...(secure ? [`${SECURE_SESSION_COOKIE}=; ${base}; Secure`] : []),
  ];
}
