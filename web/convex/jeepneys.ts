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
    driverId: v.id("drivers"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jeepneyId, {
      activeDriverId: args.driverId,
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
