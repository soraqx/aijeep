import { mutation } from "./_generated/server";

export const populate = mutation({
    args: {},
    handler: async (ctx) => {
        console.log("Seeding AI-JEEP database...");

        // 1. Create a mock Jeepney profile
        const jeepneyId = await ctx.db.insert("jeepneys", {
            plateNumber: "PUJ 2026",
            driverName: "Juan Dela Cruz",
            status: "ACTIVE",
        });

        const now = Math.floor(Date.now() / 1000);

        // 2. Insert mock Telemetry data (Cruising through Central Luzon)
        await ctx.db.insert("telemetry", {
            jeepneyId: jeepneyId,
            gps: "14.8294, 120.8805",
            speedKmh: 42.5,
            earValue: 0.32, // Normal awake state
            accelX: 0.12,
            accelY: -0.05,
            accelZ: 9.81,
            timestamp: now,
        });

        // 3. Insert a mock Alert (To trigger your new Alerts UI)
        await ctx.db.insert("alerts", {
            jeepneyId: jeepneyId,
            alertType: "DROWSY",
            confidenceScore: 0.88,
            timestamp: now - 300, // Happened 5 minutes ago
            isResolved: false,
            // Note: We leave storageId/snapshotUrl blank or undefined here 
            // so your UI's fallback "No snapshot available" state can be tested.
        });

        return "Successfully seeded data for Jeepney: PUJ 2026";
    },
});