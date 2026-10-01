import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";
const crons = cronJobs();
crons.interval(
  "clean expired rooms and receipts",
  { minutes: 5 },
  internal.cleanup.expired,
  {},
);
export default crons;
