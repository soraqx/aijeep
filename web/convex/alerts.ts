import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insertAlert = mutation({
  args: {
    jeepneyId: v.id("jeepneys"),
    alertType: v.string(),
    timestamp: v.number(),
    confidenceScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      ...args,
      isResolved: false,
    });
  },
});

export const insertAlertWithSnapshot = mutation({
  args: {
    jeepneyId: v.id("jeepneys"),
    alertType: v.string(),
    timestamp: v.number(),
    confidenceScore: v.optional(v.number()),
    snapshotStorageId: v.string(),
    snapshotFilename: v.string(),
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
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_isResolved", (q) => q.eq("isResolved", false))
      .order("desc")
      .collect();

    // Fetch image URLs for alerts with snapshots
    const withUrls = await Promise.all(
      alerts.map(async (alert) => {
        let imageUrl = null;
        if (alert.snapshotStorageId) {
          try {
            imageUrl = await ctx.storage.getUrl(alert.snapshotStorageId);
          } catch (e) {
            console.warn(`Could not get URL for alert ${alert._id}:`, e);
          }
        }
        return {
          ...alert,
          imageUrl,
        };
      })
    );

    return withUrls;
  },
});

export const getAlertWithImage = query({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) return null;

    let imageUrl = null;
    if (alert.snapshotStorageId) {
      try {
        imageUrl = await ctx.storage.getUrl(alert.snapshotStorageId);
      } catch (e) {
        console.warn(`Could not get URL for ${args.alertId}:`, e);
      }
    }

    return {
      ...alert,
      imageUrl,
    };
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
