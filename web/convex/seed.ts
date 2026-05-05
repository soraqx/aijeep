import { mutation } from "./_generated/server";

export const populate = mutation({
    args: {},
    handler: async (ctx) => {
        console.log("Seeding vehicles...");

        // 1. Create mock Jeepneys (Vehicles)
        const jeepney1Id = await ctx.db.insert("jeepneys", {
            plateNumber: "PUJ 2026",
            status: "active",
        });

        const jeepney2Id = await ctx.db.insert("jeepneys", {
            plateNumber: "PUJ 2027",
            status: "active",
        });

        const jeepney3Id = await ctx.db.insert("jeepneys", {
            plateNumber: "PUJ 2028",
            status: "inactive",
        });

        return `Successfully seeded vehicles:
        - ${jeepney1Id}
        - ${jeepney2Id}
        - ${jeepney3Id}`;
    },
});