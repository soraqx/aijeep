import { internalMutation, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

async function getUserByClerkId(ctx: any, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q: any) => q.eq("clerkId", clerkId))
    .unique();
}

async function getCurrentUserFromIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  // identity.subject perfectly matches the clerkId we save in the webhook
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q: any) =>
      q.eq("clerkId", identity.subject)
    )
    .unique();
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUserFromIdentity(ctx);
  },
});

export const getCurrentUserRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserFromIdentity(ctx);
    return user?.role ?? "pending";
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromIdentity(ctx);
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
    // Step 1: Authenticate the caller
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated call: You must be logged in to update user roles.");
    }

    // Step 2: Find the caller's user record
    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!callerUser) {
      console.error("[Users] Caller user profile not found for clerkId:", identity.subject);
      throw new ConvexError("Caller user profile not found in the database.");
    }

    // Step 3: Verify caller is an admin
    if (callerUser.role !== "admin") {
      throw new ConvexError("Unauthorized: Only admins can update user roles.");
    }

    // Step 4: Validate the new role
    if (!["admin", "guest", "pending"].includes(args.newRole)) {
      throw new ConvexError("Invalid role: Role must be 'admin', 'guest', or 'pending'.");
    }

    // Step 5: Verify the target user exists
    const userToUpdate = await ctx.db.get(args.userId);
    if (!userToUpdate) {
      throw new ConvexError("Target user not found: The user you are trying to update does not exist.");
    }

    // Step 6: Execute the update
    try {
      await ctx.db.patch(args.userId, { role: args.newRole });
      console.log("[Users] User role updated:", args.userId, "->", args.newRole, "by", callerUser._id);
      return { success: true, message: "User role updated successfully." };
    } catch (error) {
      console.error("[Users] Database patch error:", error);
      throw new ConvexError("Failed to update user role: An unexpected error occurred.");
    }
  },
});

export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Step 1: Authenticate the caller
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated call: You must be logged in to delete users.");
    }

    // Step 2: Find the caller's user record in the database
    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!callerUser) {
      console.error("[Users] Caller user profile not found for clerkId:", identity.subject);
      throw new ConvexError("Caller user profile not found in the database.");
    }

    // Step 3: Verify caller is an admin
    if (callerUser.role !== "admin") {
      throw new ConvexError("Unauthorized: Only admins can delete users.");
    }

    // Step 4: Prevent self-deletion
    if (callerUser._id === args.userId) {
      throw new ConvexError("Action denied: You cannot delete your own account.");
    }

    // Step 5: Verify the target user exists
    const userToDelete = await ctx.db.get(args.userId);
    if (!userToDelete) {
      throw new ConvexError("Target user not found: The user you are trying to delete does not exist.");
    }

    // Step 6: Execute the deletion
    try {
      await ctx.db.delete(args.userId);
      console.log("[Users] User deleted successfully:", args.userId, "by", callerUser._id);
      return { success: true, message: "User deleted successfully." };
    } catch (error) {
      console.error("[Users] Database delete error:", error);
      throw new ConvexError("Failed to delete user: An unexpected error occurred during deletion.");
    }
  },
});

// Internal mutation to create/update user from Clerk webhook
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists by clerkId to prevent duplicates
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q: any) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existingUser) {
      // User already exists, return existing ID
      console.log("[Users] User already exists:", existingUser._id);
      return existingUser._id;
    }

    // Create new user with default role: "pending"
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      role: "pending",
      tokenIdentifier: args.tokenIdentifier,
    });

    console.log("[Users] Created new user:", userId);
    return userId;
  },
});