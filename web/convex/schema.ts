import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  drivers: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    contactNumber: v.optional(v.string()),
    licenseNumber: v.optional(v.string()),
  }),

  jeepneys: defineTable({
    plateNumber: v.string(),
    activeDriverId: v.optional(v.id("drivers")),
    status: v.string(),
  })
    .index("by_plateNumber", ["plateNumber"])
    .index("by_activeDriverId", ["activeDriverId"]),

  telemetry: defineTable({
    jeepneyId: v.id("jeepneys"),
    gps: v.string(),
    earValue: v.number(),
    accelX: v.number(),
    accelY: v.number(),
    accelZ: v.number(),
    speedKmh: v.optional(v.number()),
    timestamp: v.number(),
    isAlertRelated: v.optional(v.boolean()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_jeepneyId", ["jeepneyId"])
    .index("by_jeepney_timestamp", ["jeepneyId", "timestamp"]),

  alerts: defineTable({
    jeepneyId: v.id("jeepneys"),
    alertType: v.string(),
    timestamp: v.number(),
    confidenceScore: v.optional(v.number()), // Model confidence 0.0-1.0
    snapshotStorageId: v.optional(v.string()), // Convex file storage ID
    snapshotFilename: v.optional(v.string()), // Original filename from edge
    isResolved: v.boolean(),
  })
    .index("by_isResolved", ["isResolved"])
    .index("by_timestamp", ["timestamp"])
    .index("by_jeepneyId", ["jeepneyId"])
    .index("by_jeepney_timestamp", ["jeepneyId", "timestamp"])
    .index("by_isResolved_timestamp", ["isResolved", "timestamp"]),

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    role: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_tokenIdentifier", ["tokenIdentifier"]),
});
