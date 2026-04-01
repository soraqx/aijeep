import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insertAlert = mutation({
  args: {
    jeepneyId: v.id("jeepneys"),
    alertType: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      ...args,
      isResolved: false,
    });
  },
});

export const getActiveAlerts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_isResolved", (q) => q.eq("isResolved", false))
      .order("desc")
      .collect();
  },
});

export const resolveAlert = mutation({
  args: {
    alertId: v.id("alerts"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, { isResolved: true });
    return { success: true };
  },
});
