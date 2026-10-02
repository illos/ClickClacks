// SPDX-License-Identifier: MIT
import {expect, test} from "vitest";
import {makeFunctionReference} from "convex/server";
import {backend} from "./fixtures/table";
const signIn = makeFunctionReference<"action">("auth:signIn");

test("direct password signup is refused before creating users or credentials", async () => {
  const t = backend();
  await expect(t.action(signIn, {provider: "password", params: {
    flow: "signUp", email: "new@example.invalid", password: "new-account-password",
  }})).rejects.toThrow("Account registration is closed.");
  expect(await t.run(ctx => ctx.db.query("users").collect())).toHaveLength(0);
  expect(await t.run(ctx => ctx.db.query("authAccounts").collect())).toHaveLength(0);
});

test("signing in with an unknown email cannot create an account", async () => {
  const t = backend();
  await expect(t.action(signIn, {provider: "password", params: {
    flow: "signIn", email: "unknown@example.invalid", password: "unknown-account-password",
  }})).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("users").collect())).toHaveLength(0);
  expect(await t.run(ctx => ctx.db.query("authAccounts").collect())).toHaveLength(0);
});
