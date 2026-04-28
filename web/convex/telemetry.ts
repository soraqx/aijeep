import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    jeepneyId: v.id("jeepneys"),
    gps: v.string(), // "lat,lng" for Leaflet
    earValue: v.number(),
    accelX: v.number(),
    accelY: v.number(),
    accelZ: v.number(),
    speedKmh: v.optional(v.number()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("telemetry", args);
  },
});

export const getLatest = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requested = args.limit ?? 100;
    const safeLimit = Math.max(50, Math.min(requested, 100));

    return await ctx.db
      .query("telemetry")
      .withIndex("by_timestamp")
      .order("desc")
      .take(safeLimit);
  },
});

export const getLatestByJeepneyId = query({
  args: {
    jeepneyId: v.id("jeepneys"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("telemetry")
      .withIndex("by_jeepney_timestamp", (q) => q.eq("jeepneyId", args.jeepneyId))
      .order("desc")
      .first();
  },
});

export const pruneOldTelemetry = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;

    const oldTelemetry = await ctx.db
      .query("telemetry")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .collect();

    await Promise.all(
      oldTelemetry.map(async (entry) => {
        if (!entry.isAlertRelated) {
          await ctx.db.delete(entry._id);
        }
      })
    );

    return { deleted: oldTelemetry.filter((entry) => !entry.isAlertRelated).length };
  },
});
