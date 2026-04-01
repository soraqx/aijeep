import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  jeepneys: defineTable({
    plateNumber: v.string(),
    driverName: v.string(),
    status: v.string()
  }).index("by_plateNumber", ["plateNumber"]),

  telemetry: defineTable({
    jeepneyId: v.id("jeepneys"),
    gps: v.string(),
    earValue: v.number(),
    accelX: v.number(),
    accelY: v.number(),
    accelZ: v.number(),
    timestamp: v.number()
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_jeepneyId", ["jeepneyId"])
    .index("by_jeepney_timestamp", ["jeepneyId", "timestamp"]),

  alerts: defineTable({
    jeepneyId: v.id("jeepneys"),
    alertType: v.string(),
    timestamp: v.number(),
    isResolved: v.boolean()
  })
    .index("by_isResolved", ["isResolved"])
    .index("by_timestamp", ["timestamp"])
    .index("by_jeepneyId", ["jeepneyId"])
    .index("by_jeepney_timestamp", ["jeepneyId", "timestamp"])
    .index("by_isResolved_timestamp", ["isResolved", "timestamp"])
});
