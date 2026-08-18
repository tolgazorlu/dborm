import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, isStrongEnough, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";
import { emailMatches } from "./store";

test("a hash verifies against its own password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
});

test("a hash rejects a different password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery stapl", hash), false);
});

test("the same password produces different hashes", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
});

test("the plaintext password never appears in the hash", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(hash.includes("correct"), false);
  assert.match(hash, /^scrypt\$\d+\$\d+\$\d+\$/);
});

test("a malformed hash is rejected rather than throwing", async () => {
  for (const stored of ["", "nonsense", "scrypt$15$8$1$notbase64", "bcrypt$15$8$1$c2FsdA==$aGFzaA=="]) {
    assert.equal(await verifyPassword("whatever", stored), false);
  }
});

test("a tampered cost factor is rejected", async () => {
  const hash = await hashPassword("correct horse battery staple");
  const tampered = hash.replace(/^scrypt\$\d+/, "scrypt$1");
  assert.equal(await verifyPassword("correct horse battery staple", tampered), false);
});

test("unicode passwords are normalised consistently", async () => {
  const hash = await hashPassword("şifre-çokgüçlü-2026");
  assert.equal(await verifyPassword("şifre-çokgüçlü-2026", hash), true);
});

test("short passwords are refused", () => {
  assert.equal(isStrongEnough("a".repeat(MIN_PASSWORD_LENGTH - 1)), false);
  assert.equal(isStrongEnough("a".repeat(MIN_PASSWORD_LENGTH)), true);
});

test("email comparison is case and whitespace insensitive", () => {
  assert.equal(emailMatches("  User@Example.COM ", "user@example.com"), true);
  assert.equal(emailMatches("other@example.com", "user@example.com"), false);
});
