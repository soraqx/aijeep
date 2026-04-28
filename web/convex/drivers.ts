import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("drivers").collect();
    },
});

export const getById = query({
    args: {
        driverId: v.id("drivers"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.driverId);
    },
});

export const createDriver = mutation({
    args: {
        firstName: v.string(),
        lastName: v.string(),
        contactNumber: v.optional(v.string()),
        licenseNumber: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("drivers", args);
    },
});

export const updateDriver = mutation({
    args: {
        driverId: v.id("drivers"),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        contactNumber: v.optional(v.string()),
        licenseNumber: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const updates: Record<string, string | undefined> = {};
        if (args.firstName !== undefined) updates.firstName = args.firstName;
        if (args.lastName !== undefined) updates.lastName = args.lastName;
        if (args.contactNumber !== undefined) updates.contactNumber = args.contactNumber;
        if (args.licenseNumber !== undefined) updates.licenseNumber = args.licenseNumber;

        return await ctx.db.patch(args.driverId, updates);
    },
});

export const deleteDriver = mutation({
    args: {
        driverId: v.id("drivers"),
    },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.driverId);
        return true;
    },
});
