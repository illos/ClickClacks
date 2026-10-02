// SPDX-License-Identifier: MIT
import { cronJobs, makeFunctionReference } from "convex/server";
import { api } from "./_generated/api";
const crons = cronJobs();
crons.interval("summarize multiplayer presence", {minutes: 1}, makeFunctionReference<"mutation", {}, number>("activity:flush"), {});
crons.interval(
  "expire standalone dice rooms",
  { minutes: 5 },
  api.cleanup.expired,
  {},
);
export default crons;
