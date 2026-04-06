import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getUserByClerkId(ctx: any, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q: any) => q.eq("clerkId", clerkId))
    .unique();
}

async function getCurrentUserByToken(ctx: any) {
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

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUserByToken(ctx);
  },
});

export const getCurrentUserRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserByToken(ctx);
    return user?.role ?? "pending";
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserByToken(ctx);
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Unauthorized: admin role required");
    }

    return await ctx.db.query("users").collect();
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    newRole: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserByToken(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized: authentication required");
    }
    if (currentUser.role !== "admin") {
      throw new Error("Unauthorized: admin role required");
    }

    if (!["admin", "pending"].includes(args.newRole)) {
      throw new Error("Invalid role");
    }

    await ctx.db.patch(args.userId, { role: args.newRole });
  },
});

// Public mutation to create/update user from Clerk webhook
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists by clerkId to prevent duplicates
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q: any) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existingUser) {
      // User already exists, return existing ID
      return existingUser._id;
    }

    // Create new user with default role: "pending"
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      role: "pending",
    });

    return userId;
  },
});