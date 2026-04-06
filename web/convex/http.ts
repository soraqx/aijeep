import { httpRouter } from "convex/server";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

const preflightHandler = httpAction(async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
});

http.route({
  path: "/api/telemetry",
  method: "OPTIONS",
  handler: preflightHandler,
});

http.route({
  path: "/api/telemetry",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await request.json();

      const telemetryId = await ctx.runMutation(api.telemetry.insert, {
        jeepneyId: payload.jeepneyId,
        gps: payload.gps,
        earValue: payload.earValue,
        accelX: payload.accelX,
        accelY: payload.accelY,
        accelZ: payload.accelZ,
        timestamp: payload.timestamp,
      });

      return jsonResponse({ success: true, telemetryId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid telemetry payload";
      return jsonResponse({ success: false, error: message }, 400);
    }
  }),
});

http.route({
  path: "/api/alerts",
  method: "OPTIONS",
  handler: preflightHandler,
});

http.route({
  path: "/api/alerts",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await request.json();

      const alertId = await ctx.runMutation(api.alerts.insertAlert, {
        jeepneyId: payload.jeepneyId,
        alertType: payload.alertType,
        timestamp: payload.timestamp,
      });

      return jsonResponse({ success: true, alertId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid alert payload";
      return jsonResponse({ success: false, error: message }, 400);
    }
  }),
});

http.route({
  path: "/api/upload-alert",
  method: "OPTIONS",
  handler: preflightHandler,
});

http.route({
  path: "/api/upload-alert",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Parse multipart form data
      const formData = await request.formData();

      const image = formData.get("image") as File;
      const jeepneyId = formData.get("jeepneyId") as string;
      const alertType = formData.get("alertType") as string;
      const timestamp = parseInt(formData.get("timestamp") as string);
      const filename = formData.get("filename") as string;

      // Validate inputs
      if (!image || !jeepneyId || !alertType || !timestamp) {
        return jsonResponse(
          { error: "Missing required fields: image, jeepneyId, alertType, timestamp" },
          400
        );
      }

      // Store image in Convex file storage
      const imageBuffer = await image.arrayBuffer();
      const storageId = await ctx.storage.store(
        new Blob([imageBuffer], { type: "image/jpeg" })
      );

      // Generate mock confidence score (in production: from model output)
      const confidenceScore = Math.random() * 0.3 + 0.7; // 70-100%

      // Create alert record with image reference (in one atomic operation)
      const alertId = await ctx.runMutation(api.alerts.insertAlertWithSnapshot, {
        jeepneyId: jeepneyId as any,
        alertType,
        timestamp,
        confidenceScore,
        snapshotStorageId: storageId,
        snapshotFilename: filename || `alert_${timestamp}.jpg`,
      });

      console.log(
        `[HTTP] Alert snapshot stored: ${alertId} from ${jeepneyId} - ${alertType}`
      );

      return jsonResponse({
        success: true,
        alertId,
        message: "Snapshot received and stored",
      });
    } catch (error) {
      console.error("[HTTP] Upload error:", error);
      const message =
        error instanceof Error ? error.message : "Upload failed";
      return jsonResponse({ error: message }, 500);
    }
  }),
});

// Clerk webhook endpoint for syncing users
http.route({
  path: "/webhook/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    console.log("[Clerk Webhook] Received");
    console.log("📥 Webhook received. Payload length:", 0); // Will update below

    // Get the Svix headers for verification
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    console.log("[Clerk Webhook] Headers:", { svixId, svixTimestamp, svixSignature: svixSignature?.slice(0, 20) + "..." });

    // If no Svix headers, return 400
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("[Clerk Webhook] Missing Svix headers");
      return new Response("Missing Svix headers", { status: 400 });
    }

    // Get the webhook secret from environment variables
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Clerk Webhook] CLERK_WEBHOOK_SECRET is not set");
      return new Response("Internal server error", { status: 500 });
    }

    // Get the raw body for verification - MUST be raw string for Svix
    const payloadString = await request.text();
    console.log("📥 Webhook received. Payload length:", payloadString.length);

    // Create a Svix instance with the secret
    const wh = new Webhook(webhookSecret);

    let evt;
    try {
      // Verify the webhook signature using raw payload string
      evt = wh.verify(payloadString, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
      console.log("[Clerk Webhook] Verification successful:", JSON.stringify(evt));
    } catch (err) {
      console.error("[Clerk Webhook] Verification failed:", err);
      console.error("❌ Svix Verification Failed:", err);
      return new Response("Verification error", { status: 400 });
    }

    console.log("✅ Webhook verified! Event Type:", (evt as any).type);

    // Handle the user.created event
    const webhookEvent = evt as { type: string; data: any };
    console.log("[Clerk Webhook] Event type:", webhookEvent.type);

    if (webhookEvent.type === "user.created") {
      const { id, email_addresses, first_name, last_name } = webhookEvent.data;
      console.log("[Clerk Webhook] User data:", { id, email_addresses, first_name, last_name });

      // Get the primary email address
      const primaryEmail = email_addresses?.find(
        (email: any) => email.id === webhookEvent.data.primary_email_address_id
      )?.email_address;

      if (!primaryEmail) {
        console.error("[Clerk Webhook] No primary email found in:", email_addresses);
        return new Response("No primary email found", { status: 400 });
      }

      console.log("[Clerk Webhook] Preparing to insert user:", { clerkId: id, email: primaryEmail, firstName: first_name, lastName: last_name });
      console.log("💾 Attempting to insert user into Convex:", { clerkId: id, email: primaryEmail });

      // Call the internal mutation to create the user
      await ctx.runMutation(internal.users.createUser, {
        clerkId: id,
        email: primaryEmail,
        firstName: first_name ?? undefined,
        lastName: last_name ?? undefined,
        tokenIdentifier: id, // Clerk user ID maps to tokenIdentifier
      });

      console.log("[Clerk Webhook] User synced successfully");
      console.log("🎉 User successfully inserted!");
      return new Response("User synced successfully", { status: 200 });
    }

    // For other event types, just return 200
    console.log("[Clerk Webhook] Event received but not user.created:", webhookEvent.type);
    return new Response("Event received", { status: 200 });
  }),
});

export default http;
