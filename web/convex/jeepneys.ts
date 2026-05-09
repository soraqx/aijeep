import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getJeepneys = query({
  args: {},
  handler: async (ctx) => {
    const jeepneys = await ctx.db.query("jeepneys").collect();

    return await Promise.all(
      jeepneys.map(async (jeepney) => {
        const activeDriver = jeepney.activeDriverId
          ? await ctx.db.get(jeepney.activeDriverId)
          : null;

        return {
          ...jeepney,
          driverName: activeDriver
            ? `${activeDriver.firstName} ${activeDriver.lastName}`
            : null,
          activeDriver: activeDriver ?? null,
        };
      })
    );
  },
});

export const getAll = getJeepneys;

export const assignDriver = mutation({
  args: {
    jeepneyId: v.id("jeepneys"),
    driverId: v.optional(v.union(v.id("drivers"), v.null())),
  },
  handler: async (ctx, args) => {
    // If assigning a valid driver, enforce 1:1 relationship
    if (args.driverId) {
      // Find any other jeepney currently assigned to this driver
      const existingJeepneys = await ctx.db
        .query("jeepneys")
        .filter((q) => q.eq(q.field("activeDriverId"), args.driverId))
        .collect();

      // Unassign the driver from any other jeepney
      for (const jeepney of existingJeepneys) {
        if (jeepney._id !== args.jeepneyId) {
          await ctx.db.patch(jeepney._id, {
            activeDriverId: null,
          });
        }
      }
    }

    // Assign (or unassign if null) the driver to the target jeepney
    await ctx.db.patch(args.jeepneyId, {
      activeDriverId: args.driverId || null,
    });
    return true;
  },
});

export const updateJeepneyStatus = mutation({
  args: {
    jeepneyId: v.id("jeepneys"),
    newStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const updated = await ctx.db.patch(args.jeepneyId, {
      status: args.newStatus,
    });
    return updated;
  },
});
