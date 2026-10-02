// SPDX-License-Identifier: MIT
// Explicit target file; never inherit the ambient Salient deployment key.
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {generateKeyPair, exportPKCS8, exportJWK} from "jose";
const envFile = process.argv[2];
if (!envFile) throw new Error("Usage: node scripts/configure-stats-auth.mjs /absolute/path/to/target.env");
const text = await readFile(envFile, "utf8");
const deployment = text.match(/^CONVEX_DEPLOYMENT=([^\s#]+)/m)?.[1];
const local = text.match(/^CONVEX_SELF_HOSTED_URL=(https?:\/\/[^\s#]+)/m)?.[1];
if (deployment !== "dev:nautical-partridge-636" && !(local && ["localhost", "127.0.0.1"].includes(new URL(local).hostname)))
  throw new Error("Only the dedicated Click Clacks dev deployment or an explicit local backend is allowed.");
const env = {...process.env}; delete env.CONVEX_DEPLOY_KEY;
const run = (...args) => execFileSync("pnpm", ["exec", "convex", "env", ...args, "--env-file", envFile], {env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]});
const get = name => {try {return run("get", name).trim();} catch {return "";}};
const privateKey = get("JWT_PRIVATE_KEY"), jwks = get("JWKS");
if (!!privateKey !== !!jwks) throw new Error("Incomplete existing auth key pair. Repair it before configuring auth.");
if (!privateKey) {
  const keys = await generateKeyPair("RS256", {extractable: true});
  run("set", `JWT_PRIVATE_KEY=${(await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ")}`);
  run("set", `JWKS=${JSON.stringify({keys: [{use: "sig", ...await exportJWK(keys.publicKey)}]})}`);
}
run("set", "SITE_URL=https://stats.clickclacks.app");
console.log(`Stats auth configured for ${deployment ?? local}; existing keys preserved. No key material printed.`);
