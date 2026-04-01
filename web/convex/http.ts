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

export default http;
