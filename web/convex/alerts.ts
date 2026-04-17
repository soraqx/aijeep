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

    // Fetch image URLs and jeepney info for each alert
    const withDetails = await Promise.all(
      alerts.map(async (alert) => {
        let imageUrl = null;
        if (alert.snapshotStorageId) {
          try {
            imageUrl = await ctx.storage.getUrl(alert.snapshotStorageId);
          } catch (e) {
            console.warn(`Could not get URL for alert ${alert._id}:`, e);
          }
        }

        const jeepney = await ctx.db.get(alert.jeepneyId);

        return {
          ...alert,
          imageUrl,
          jeepneyInfo: jeepney ? {
            plateNumber: jeepney.plateNumber,
            driverName: jeepney.driverName,
            status: jeepney.status,
          } : null,
        };
      })
    );

    return withDetails;
  },
});

export const getAllAlerts = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requested = args.limit ?? 50;
    const safeLimit = Math.max(1, Math.min(requested, 100));

    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_timestamp")
      .order("desc")
      .take(safeLimit);

    const withDetails = await Promise.all(
      alerts.map(async (alert) => {
        let imageUrl = null;
        if (alert.snapshotStorageId) {
          try {
            imageUrl = await ctx.storage.getUrl(alert.snapshotStorageId);
          } catch (e) {
            console.warn(`Could not get URL for alert ${alert._id}:`, e);
          }
        }

        const jeepney = await ctx.db.get(alert.jeepneyId);

        return {
          ...alert,
          imageUrl,
          jeepneyInfo: jeepney ? {
            plateNumber: jeepney.plateNumber,
            driverName: jeepney.driverName,
            status: jeepney.status,
          } : null,
        };
      })
    );

    return withDetails;
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

    const jeepney = await ctx.db.get(alert.jeepneyId);

    return {
      ...alert,
      imageUrl,
      snapshotUrl: imageUrl,
      jeepneyInfo: jeepney ? {
        plateNumber: jeepney.plateNumber,
        driverName: jeepney.driverName,
        status: jeepney.status,
      } : null,
    };
  },
});

export const getAlertStats = query({
  args: {},
  handler: async (ctx) => {
    const allAlerts = await ctx.db.query("alerts").collect();

    // Get today's start (midnight UTC)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStartTs = Math.floor(todayStart.getTime() / 1000);

    const todayAlerts = allAlerts.filter((a) => a.timestamp >= todayStartTs);

    const stats = {
      totalToday: todayAlerts.length,
      activeToday: todayAlerts.filter((a) => !a.isResolved).length,
      resolvedToday: todayAlerts.filter((a) => a.isResolved).length,
      drowsyToday: todayAlerts.filter((a) => a.alertType === "DROWSY").length,
      harshBrakingToday: todayAlerts.filter((a) => a.alertType === "HARSH_BRAKING").length,
      // All-time counts
      totalAllTime: allAlerts.length,
      activeAllTime: allAlerts.filter((a) => !a.isResolved).length,
      resolvedAllTime: allAlerts.filter((a) => a.isResolved).length,
    };

    return stats;
  },
});

export const getAlertsByDateRange = query({
  args: {
    startTimestamp: v.number(),
    endTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const alerts = await ctx.db
      .query("alerts")
      .filter(
        (q) =>
          q.and(
            q.gte(q.field("timestamp"), args.startTimestamp),
            q.lte(q.field("timestamp"), args.endTimestamp)
          )
      )
      .collect();

    // Group by alert type and resolve status for frequency graph
    const grouped = alerts.reduce(
      (acc, alert) => {
        const key = `${alert.alertType}_${alert.isResolved ? "resolved" : "active"}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      raw: alerts,
      grouped,
      total: alerts.length,
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

export const getAlertsByJeepneyId = query({
  args: {
    jeepneyId: v.id("jeepneys"),
  },
  handler: async (ctx, args) => {
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_jeepney_timestamp", (q) => q.eq("jeepneyId", args.jeepneyId))
      .order("desc")
      .take(20);

    const withDetails = await Promise.all(
      alerts.map(async (alert) => {
        let imageUrl = null;
        if (alert.snapshotStorageId) {
          try {
            imageUrl = await ctx.storage.getUrl(alert.snapshotStorageId);
          } catch (e) {
            console.warn(`Could not get URL for alert ${alert._id}:`, e);
          }
        }

        const jeepney = await ctx.db.get(alert.jeepneyId);

        return {
          ...alert,
          imageUrl,
          snapshotUrl: imageUrl,
          jeepneyInfo: jeepney ? {
            plateNumber: jeepney.plateNumber,
            driverName: jeepney.driverName,
            status: jeepney.status,
          } : null,
        };
      })
    );

    return withDetails;
  },
});
