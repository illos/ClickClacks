// SPDX-License-Identifier: MIT
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { reportStatuses } from "../shared/bug-report.ts";
export async function runBugs(args = process.argv.slice(2), request = fetch) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      url: { type: "string" },
      status: { type: "string" },
      json: { type: "boolean" },
      "body-file": { type: "string" },
      owner: { type: "string" },
      commit: { type: "string" },
      revision: { type: "string" },
    },
  });
  const [command, id] = positionals;
  if (!["list", "show", "submit", "update"].includes(command))
    throw new Error(
      "Usage: pnpm bugs list [--status new] | show ID | submit --body-file FILE | update ID --status STATUS --revision N [--owner THREAD_ID] [--commit SHA] [--body-file NOTES]",
    );
  const base = new URL(
    values.url ??
      process.env.CLICKCLACKS_SUPPORT_URL ??
      "https://app.clickclacks.app",
  );
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
    )
  )
    throw new Error("Support URL must use HTTPS or local HTTP.");
  const writing = command === "submit" || command === "update";
  const token = writing
    ? process.env.BUG_REPORT_WRITE_TOKEN
    : process.env.BUG_REPORT_READ_TOKEN;
  if (!token || token.length < 32)
    throw new Error(
      `Set ${writing ? "BUG_REPORT_WRITE_TOKEN" : "BUG_REPORT_READ_TOKEN"} through the host secret mechanism.`,
    );
  let path = "/api/support/reports",
    method = "GET",
    body: string | undefined;
  if (command === "list") {
    const status = values.status ?? "new";
    if (!(reportStatuses as readonly string[]).includes(status))
      throw new Error("Invalid report status.");
    path += `?status=${status}`;
  } else if (command === "submit") {
    if (!values["body-file"])
      throw new Error("Supply --body-file with a JSON report.");
    path = "/api/bug-reports";
    method = "POST";
    body = await readFile(values["body-file"], "utf8");
  } else {
    if (
      !id ||
      !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id)
    )
      throw new Error("Supply a valid report ID.");
    path += `/${id}`;
    if (command === "update") {
      const revision = Number(values.revision);
      if (
        !values.revision ||
        !Number.isSafeInteger(revision) ||
        revision < 0 ||
        !values.status ||
        !(reportStatuses as readonly string[]).includes(values.status)
      )
        throw new Error(
          "Supply --status and the --revision from the latest read.",
        );
      method = "PATCH";
      body = JSON.stringify({
        status: values.status,
        revision,
        owner: values.owner ?? "",
        fixCommit: values.commit ?? "",
        notes: values["body-file"]
          ? await readFile(values["body-file"], "utf8")
          : "",
      });
    }
  }
  const response = await request(new URL(path, base), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error ?? `Support request failed (${response.status}).`,
    );
  return result;
}
if (import.meta.main)
  runBugs()
    .then((result) =>
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
    )
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "Support command failed."}\n`,
      );
      process.exitCode = 1;
    });
