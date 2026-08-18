import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

const COST = 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

async function derive(password: string, salt: Buffer, cost: number, blockSize: number, parallelism: number): Promise<Buffer> {
  return scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH, {
    N: 2 ** cost,
    r: blockSize,
    p: parallelism,
    maxmem: MAX_MEMORY,
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM);
  return ["scrypt", COST, BLOCK_SIZE, PARALLELISM, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelism = Number(parts[3]);
  if (!Number.isInteger(cost) || cost < 12 || cost > 20) return false;
  if (!Number.isInteger(blockSize) || !Number.isInteger(parallelism)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  try {
    const actual = await derive(password, salt, cost, blockSize, parallelism);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const DUMMY_HASH = hashPassword(randomBytes(32).toString("base64"));

export async function burnTime(password: string): Promise<void> {
  await verifyPassword(password, await DUMMY_HASH);
}

export function isStrongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}
