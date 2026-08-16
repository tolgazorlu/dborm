import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { OrmId } from "@/lib/orm/types";

/**
 * Tek kullanımlık paylaşım deposu.
 *
 * Depolama dosya sistemi: harici bir bağımlılık (Redis/KV) getirmeden çalışsın
 * diye. Bu, tek süreçli bir sunucuda (dev, `next start`, Docker) doğru çalışır;
 * serverless'ta her örnek kendi diskini gördüğü için üretimde bu modülü
 * Redis/Vercel KV ile değiştirin — dışa açılan dört fonksiyon aynı kalabilir.
 *
 * "Tek kullanım" garantisi `rename` ile sağlanıyor: POSIX'te rename atomiktir,
 * dolayısıyla aynı anda gelen iki istekten yalnızca biri dosyayı ele geçirir,
 * diğeri ENOENT alır.
 */

const DATA_DIR = path.join(process.cwd(), ".data", "shares");
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface SharePayload {
  /** Şemanın hangi ORM ile açılacağı — karşı taraf doğru sekmeleri görsün diye. */
  orm: OrmId;
  /** Dosya anahtarı → içerik (ör. `{ schema: "...", relations: "..." }`) */
  sources: Record<string, string>;
}

export interface ShareRecord extends SharePayload {
  createdAt: number;
  expiresAt: number;
}

export interface ShareMeta {
  createdAt: number;
  expiresAt: number;
}

function filePath(token: string): string {
  // Token doğrulanmadan asla dosya yoluna girmemeli (path traversal).
  if (!TOKEN_PATTERN.test(token)) throw new Error("INVALID_TOKEN");
  return path.join(DATA_DIR, `${token}.json`);
}

export function isValidToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export async function createShare(
  payload: SharePayload,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<{ token: string; record: ShareRecord }> {
  await mkdir(DATA_DIR, { recursive: true });
  await sweepExpired();

  const token = randomBytes(24).toString("base64url");
  const now = Date.now();
  const record: ShareRecord = { ...payload, createdAt: now, expiresAt: now + ttlMs };

  await writeFile(filePath(token), JSON.stringify(record), "utf8");
  return { token, record };
}

/** Kaydı tüketmeden var mı / süresi geçmiş mi diye bakar. */
export async function peekShare(token: string): Promise<ShareMeta | null> {
  if (!isValidToken(token)) return null;

  try {
    const record = JSON.parse(await readFile(filePath(token), "utf8")) as ShareRecord;
    if (record.expiresAt <= Date.now()) {
      await rm(filePath(token), { force: true });
      return null;
    }
    return { createdAt: record.createdAt, expiresAt: record.expiresAt };
  } catch {
    return null;
  }
}

/**
 * Kaydı okur ve **kalıcı olarak siler**. İkinci çağrı her zaman null döner.
 */
export async function consumeShare(token: string): Promise<SharePayload | null> {
  if (!isValidToken(token)) return null;

  const source = filePath(token);
  const claimed = `${source}.claimed-${randomBytes(6).toString("hex")}`;

  try {
    // Yarışı burası çözüyor: rename'i kim kazanırsa kaydı o alır.
    await rename(source, claimed);
  } catch {
    return null;
  }

  try {
    const record = JSON.parse(await readFile(claimed, "utf8")) as ShareRecord;
    if (record.expiresAt <= Date.now()) return null;
    return { orm: record.orm, sources: record.sources };
  } catch {
    return null;
  } finally {
    await rm(claimed, { force: true });
  }
}

/** Süresi dolmuş kayıtları temizler; her oluşturmada tembel olarak çağrılır. */
async function sweepExpired(): Promise<void> {
  try {
    const entries = await readdir(DATA_DIR);
    const now = Date.now();

    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(DATA_DIR, entry);
        try {
          if (!entry.endsWith(".json")) {
            // Yarıda kalmış `.claimed-*` dosyaları
            await rm(target, { force: true });
            return;
          }
          const record = JSON.parse(await readFile(target, "utf8")) as ShareRecord;
          if (record.expiresAt <= now) await rm(target, { force: true });
        } catch {
          await rm(target, { force: true });
        }
      }),
    );
  } catch {
    // Dizin henüz yoksa temizlenecek bir şey de yoktur.
  }
}
