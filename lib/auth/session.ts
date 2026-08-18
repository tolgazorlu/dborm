import { cookies } from "next/headers";

import { AUTH_ENABLED, SECURE_SESSION_COOKIE, SESSION_COOKIE } from "./config";
import { readSession, type Session } from "./store";

export async function currentSession(): Promise<Session | null> {
  if (!AUTH_ENABLED) return null;

  const store = await cookies();
  const token =
    store.get(SECURE_SESSION_COOKIE)?.value ?? store.get(SESSION_COOKIE)?.value ?? undefined;

  return readSession(token);
}

export async function isSignedIn(): Promise<boolean> {
  if (!AUTH_ENABLED) return true;
  return (await currentSession()) !== null;
}

export function sessionTokenFrom(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === SECURE_SESSION_COOKIE || rawKey === SESSION_COOKIE) {
      return rest.join("=");
    }
  }
  return undefined;
}

export async function requestIsAuthorized(request: Request): Promise<boolean> {
  if (!AUTH_ENABLED) return true;
  return (await readSession(sessionTokenFrom(request))) !== null;
}
