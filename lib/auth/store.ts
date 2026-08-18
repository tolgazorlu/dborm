import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { sessionTtlMs } from "./config";

const DATA_DIR = path.join(process.cwd(), ".data", "auth");
const ACCOUNT_FILE = path.join(DATA_DIR, "account.json");
const SESSION_DIR = path.join(DATA_DIR, "sessions");
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

export interface Account {
  email: string;
  passwordHash: string;
  createdAt: number;
}

export interface Session {
  email: string;
  createdAt: number;
  expiresAt: number;
}

function envAccount(): Account | null {
  const email = process.env.AUTH_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.AUTH_PASSWORD_HASH?.trim();
  if (!email || !passwordHash) return null;
  return { email, passwordHash, createdAt: 0 };
}

export async function readAccount(): Promise<Account | null> {
  const seeded = envAccount();
  if (seeded) return seeded;

  try {
    const parsed = JSON.parse(await readFile(ACCOUNT_FILE, "utf8")) as Partial<Account>;
    if (typeof parsed.email !== "string" || typeof parsed.passwordHash !== "string") return null;
    return {
      email: parsed.email,
      passwordHash: parsed.passwordHash,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : 0,
    };
  } catch {
    return null;
  }
}

export async function accountExists(): Promise<boolean> {
  return (await readAccount()) !== null;
}

export async function createAccount(email: string, passwordHash: string): Promise<boolean> {
  if (await accountExists()) return false;

  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  const account: Account = { email: email.trim().toLowerCase(), passwordHash, createdAt: Date.now() };

  try {
    await writeFile(ACCOUNT_FILE, JSON.stringify(account), { encoding: "utf8", flag: "wx", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

export function emailMatches(candidate: string, stored: string): boolean {
  const a = Buffer.from(candidate.trim().toLowerCase());
  const b = Buffer.from(stored.trim().toLowerCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sessionPath(token: string): string {
  const digest = createHash("sha256").update(token).digest("hex");
  return path.join(SESSION_DIR, `${digest}.json`);
}

export async function createSession(email: string): Promise<{ token: string; expiresAt: number }> {
  await mkdir(SESSION_DIR, { recursive: true, mode: 0o700 });
  await sweepSessions();

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const session: Session = { email, createdAt: now, expiresAt: now + sessionTtlMs() };

  await writeFile(sessionPath(token), JSON.stringify(session), { encoding: "utf8", mode: 0o600 });
  return { token, expiresAt: session.expiresAt };
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token || !TOKEN_PATTERN.test(token)) return null;

  const file = sessionPath(token);
  try {
    const session = JSON.parse(await readFile(file, "utf8")) as Session;
    if (session.expiresAt <= Date.now()) {
      await rm(file, { force: true });
      return null;
    }
    const account = await readAccount();
    if (!account || account.email !== session.email) return null;
    return session;
  } catch {
    return null;
  }
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token || !TOKEN_PATTERN.test(token)) return;
  await rm(sessionPath(token), { force: true });
}

async function sweepSessions(): Promise<void> {
  try {
    const entries = await readdir(SESSION_DIR);
    const now = Date.now();

    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(SESSION_DIR, entry);
        try {
          const session = JSON.parse(await readFile(target, "utf8")) as Session;
          if (session.expiresAt <= now) await rm(target, { force: true });
        } catch {
          await rm(target, { force: true });
        }
      }),
    );
  } catch {}
}
