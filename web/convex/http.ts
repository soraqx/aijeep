import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

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

export default http;
