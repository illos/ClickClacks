// SPDX-License-Identifier: MIT
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "expire standalone dice rooms",
  { minutes: 5 },
  api.cleanup.expired,
  {},
);
export default crons;
