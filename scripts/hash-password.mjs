import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, exit } from "node:process";

const { hashPassword, isStrongEnough, MIN_PASSWORD_LENGTH } = await import("../lib/auth/password.ts");

async function read() {
  const fromArgv = argv[2];
  if (fromArgv) return fromArgv;

  const rl = createInterface({ input: stdin, output: stdout });
  const value = await rl.question("Password: ");
  rl.close();
  return value;
}

const password = await read();

if (!isStrongEnough(password)) {
  console.error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  exit(1);
}

console.log("");
console.log("AUTH_PASSWORD_HASH=" + (await hashPassword(password)));
