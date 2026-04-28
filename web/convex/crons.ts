import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
    "prune-old-telemetry",
    {
        hourUTC: 0,
        minuteUTC: 0,
    },
    internal.telemetry.pruneOldTelemetry
);

export default crons;
