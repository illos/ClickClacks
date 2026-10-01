#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { readFile, writeFile, unlink } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { resolveRoll } from "../dist/lib/dice.js";
const [operation = "help", json = "{}"] = process.argv.slice(2);
if (operation === "help") {
  console.log(
    "Usage: pnpm cli <create|join|roll|view|events|profile|heartbeat|clear|leave|clock|resolve> JSON\nSet VITE_CONVEX_URL (or POWERROLLER_CONVEX_URL) to your backend. Session credentials are saved privately in .powerroller-session.json. Supply requestId explicitly for retries. resolve takes {request,values} and needs no backend.",
  );
  process.exit(0);
}
const input = JSON.parse(json);
if (operation === "resolve") {
  console.log(JSON.stringify(resolveRoll(input.request, input.values)));
  process.exit(0);
}
if (
  ![
    "create",
    "join",
    "roll",
    "view",
    "events",
    "profile",
    "heartbeat",
    "clear",
    "leave",
    "clock",
  ].includes(operation)
)
  throw new Error("Unknown operation. Run help.");
const url = process.env.POWERROLLER_CONVEX_URL ?? process.env.VITE_CONVEX_URL;
if (!url)
  throw new Error("Set POWERROLLER_CONVEX_URL to your own backend URL.");
const sessionFile =
  process.env.POWERROLLER_SESSION_FILE ?? ".powerroller-session.json";
let session;
try {
  session = JSON.parse(await readFile(sessionFile, "utf8"));
  if (session.backend !== url) session = undefined;
} catch {}
const client = new ConvexHttpClient(url);
let args = { ...input };
if (operation === "create" || operation === "join")
  args = { name: "CLI Player", ...input, credential: crypto.randomUUID() };
else if (operation !== "clock") {
  if (!session) throw new Error("Create or join a table first.");
  args = { ...input, roomId: session.roomId, credential: session.credential };
}
const reference = makeFunctionReference(`rooms:${operation}`);
const result = ["roll", "clock"].includes(operation)
  ? await client.action(reference, args)
  : ["view", "events"].includes(operation)
    ? await client.query(reference, args)
    : await client.mutation(reference, args);
if (operation === "create" || operation === "join") {
  await writeFile(
    sessionFile,
    JSON.stringify({
      backend: url,
      roomId: result.room.id,
      memberId: result.member.id,
      credential: args.credential,
    }) + "\n",
    { mode: 0o600 },
  );
}
if (operation === "leave") await unlink(sessionFile).catch(() => {});
console.log(JSON.stringify(result));
