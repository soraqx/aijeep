import { mutation, query } from "./_generated/server";
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

export const getRecentByJeepneyId = query({
  args: {
    jeepneyId: v.id("jeepneys"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requested = args.limit ?? 50;
    const safeLimit = Math.max(1, Math.min(requested, 100));

    return await ctx.db
      .query("telemetry")
      .withIndex("by_jeepney_timestamp")
      .order("desc")
      .take(safeLimit);
  },
});
