import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getUserByIdentityToken(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const tokenIdentifier = identity.tokenIdentifier;
  if (!tokenIdentifier) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", tokenIdentifier)
    )
    .unique();
}

export const getCurrentUserRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserByIdentityToken(ctx);
    return user?.role ?? "guest";
    
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getUserByIdentityToken(ctx);
    if (!currentUser || currentUser.role !== "operator") {
      throw new Error("Unauthorized: operator role required");
    }

    return await ctx.db.query("users").collect();
  },
});

export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.string(),
    tokenIdentifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      role: args.role,
      tokenIdentifier: args.tokenIdentifier,
    });
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    newRole: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getUserByIdentityToken(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized: authentication required");
    }
    if (currentUser.role !== "operator") {
      throw new Error("Unauthorized: operator role required");
    }

    if (!["operator", "driver", "guest"].includes(args.newRole)) {
      throw new Error("Invalid role");
    }

    await ctx.db.patch(args.userId, { role: args.newRole });
  },
});
