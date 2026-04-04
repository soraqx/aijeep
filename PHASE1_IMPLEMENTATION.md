# AI-JEEP Phase 1 Implementation Guide

## Quick Start: Alert Snapshot Upload to Convex

This guide walks through implementing the **HTTP Upload strategy** (Strategy 1) for syncing alert snapshots from the Raspberry Pi to your dashboard.

---

## Part 1: Update Edge Detector with Upload

### Step 1: Add upload function to `edge/detector.py`

Replace the existing `_save_alert_snapshot()` function with this enhanced version:

```python
def _save_alert_snapshot_with_upload(
    frame: any,
    alerts_dir: str,
    jeepney_id: str,
    alert_type: str,
    timestamp: Optional[int] = None,
    upload_url: Optional[str] = None,
    timeout_sec: float = 5.0,
) -> Optional[str]:
    """
    Save snapshot locally AND attempt to upload to backend.
    
    Args:
        frame: OpenCV frame (BGR format)
        alerts_dir: Local directory to store snapshots
        jeepney_id: Jeepney identifier
        alert_type: Type of alert (DROWSY, HARSH_BRAKING)
        timestamp: Unix timestamp (defaults to now)
        upload_url: Backend URL for upload (optional)
        timeout_sec: HTTP timeout
    
    Returns:
        Filename if saved successfully
    """
    try:
        Path(alerts_dir).mkdir(parents=True, exist_ok=True)
        
        if timestamp is None:
            timestamp = int(time.time())
        
        dt = datetime.utcfromtimestamp(timestamp)
        filename = dt.strftime("alert_%Y%m%d_%H%M%S.jpg")
        filepath = os.path.join(alerts_dir, filename)
        
        # Save locally first
        success = cv2.imwrite(filepath, frame)
        if not success:
            print(f"[Alert] Failed to write snapshot: {filepath}")
            return None
        
        print(f"[Alert] Snapshot saved locally: {filename}")
        
        # Try to upload if URL provided
        if upload_url:
            try:
                ret, jpeg_buffer = cv2.imencode('.jpg', frame)
                if not ret:
                    print("[Alert] Failed to encode frame for upload")
                    return filename
                
                files = {'image': ('alert.jpg', jpeg_buffer.tobytes(), 'image/jpeg')}
                data = {
                    'jeepneyId': jeepney_id,
                    'alertType': alert_type,
                    'timestamp': str(timestamp),
                    'filename': filename,
                }
                
                if requests is not None:
                    resp = requests.post(
                        upload_url,
                        files=files,
                        data=data,
                        timeout=timeout_sec
                    )
                    if resp.status_code == 200:
                        print(f"[Alert] Snapshot uploaded successfully: {filename}")
                    else:
                        print(f"[Alert] Upload failed ({resp.status_code}): {resp.text[:100]}")
            except Exception as e:
                print(f"[Alert] Upload error (continuing with local): {e.__class__.__name__}: {e}")
        
        return filename
        
    except Exception as e:
        print(f"[Alert] Snapshot error: {e.__class__.__name__}: {e}")
        return None
```

### Step 2: Update main() configuration

Add these environment variables to your configuration section:

```python
def main() -> None:
    # ... existing config ...
    
    # Alert snapshot upload configuration
    BACKEND_ALERT_UPLOAD_URL = os.environ.get(
        "BACKEND_ALERT_UPLOAD_URL",
        "https://your-convex-site.convex.site/api/upload-alert"
    )
    
    # ... rest of config ...
```

### Step 3: Update the snapshot capture in main loop

Replace the current snapshot capture code with:

```python
# ---- Snapshot capture with optional upload ----
if pred in HAZARDOUS_PREDICTIONS:
    if ret and frame is not None and (now_mono - last_snapshot_saved_mono >= SNAPSHOT_COOLDOWN_SEC):
        timestamp = int(time.time())
        _save_alert_snapshot_with_upload(
            frame,
            ALERTS_DIR,
            JEEPNEY_ID,
            ALERT_TYPE_MAP.get(pred, "UNKNOWN"),
            timestamp,
            upload_url=BACKEND_ALERT_UPLOAD_URL,
            timeout_sec=REQUEST_TIMEOUT_SEC,
        )
        last_snapshot_saved_mono = now_mono
```

### Step 4: Update requirements.txt (if needed)

Ensure you have `requests` for multipart uploads:
```txt
requests >= 2.28
```

---

## Part 2: Create Convex HTTP Endpoint

### Create/Update `convex/http.ts`

Add a new route for handling alert uploads:

```typescript
import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

export const http = httpRouter();

// POST /api/upload-alert - Receive snapshot from edge
http.route({
  path: "/api/upload-alert",
  method: "POST",
  handler: async (request, ctx) => {
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
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Store image in Convex file storage
      const imageBuffer = await image.arrayBuffer();
      const storageId = await ctx.storage.store(
        new Blob([imageBuffer], { type: "image/jpeg" })
      );

      // Determine confidence score (in real implementation from model output)
      const confidenceScore = Math.random() * 0.3 + 0.7; // Mock: 70-100%

      // Create alert record
      const alertId = await ctx.db.insert("alerts", {
        jeepneyId,
        alertType: alertType as "DROWSY" | "HARSH_BRAKING",
        timestamp,
        confidenceScore,
        snapshotStorageId: storageId,
        snapshotFilename: filename,
        isResolved: false,
        _creationTime: Date.now(),
      });

      console.log(`[HTTP] Alert stored: ${alertId} from ${jeepneyId}`);

      return new Response(
        JSON.stringify({
          success: true,
          alertId,
          message: "Snapshot received and stored",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Upload error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
});
```

---

## Part 3: Update Convex Schema & Queries

### Update `convex/schema.ts`

Add/update the alerts table:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ... existing tables ...

  alerts: defineTable({
    jeepneyId: v.string(),
    alertType: v.union(v.literal("DROWSY"), v.literal("HARSH_BRAKING")),
    timestamp: v.number(), // Unix timestamp
    confidenceScore: v.number(), // 0.0 to 1.0
    snapshotStorageId: v.optional(v.string()), // Convex file storage ID
    snapshotFilename: v.optional(v.string()), // Original filename
    isResolved: v.boolean(),
    _creationTime: v.number(),
  })
    .index("by_jeepney_time", ["jeepneyId", "timestamp"])
    .index("by_resolved", ["isResolved"]),

  // ... rest of schema ...
});
```

### Update `convex/alerts.ts`

Add a query to fetch alerts with image URLs:

```typescript
import { query } from "convex/server";
import { v } from "convex/values";

export const getActiveAlerts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const alerts = await ctx.db
      .query("alerts")
      .filter((q) => q.eq(q.field("isResolved"), false))
      .order("desc")
      .take(args.limit || 50);

    // Fetch image URLs for each alert
    const withUrls = await Promise.all(
      alerts.map(async (alert) => {
        let imageUrl = null;
        if (alert.snapshotStorageId) {
          try {
            imageUrl = await ctx.storage.getUrl(alert.snapshotStorageId);
          } catch (e) {
            console.warn(`Could not get URL for ${alert._id}:`, e);
          }
        }
        return {
          ...alert,
          imageUrl,
        };
      })
    );

    return withUrls;
  },
});

export const resolveAlert = mutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.alertId, { isResolved: true });
  },
});
```

---

## Part 4: Update Frontend to Use Real Data

### Update `web/src/pages/DashboardPage.tsx`

Modify the snapshot-alerts section to use real image URLs:

```typescript
{activeTab === "snapshot-alerts" && (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-slate-800">Active Alerts Gallery</h2>
      {alertCount > 0 && (
        <span className="rounded-full border-2 border-red-500 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
          {alertCount} Active
        </span>
      )}
    </div>
    <AlertsGallery
      alerts={
        alertData
          ?.filter((a: Alert) => !a.isResolved)
          .slice(0, 12)
          .map((alert) => ({
            id: alert._id,
            jeepneyId: alert.jeepneyId,
            alertType: alert.alertType as "DROWSY" | "HARSH_BRAKING" | "UNKNOWN",
            timestamp: alert.timestamp,
            confidenceScore: alert.confidenceScore || 0.85,
            snapshotUrl: alert.imageUrl, // Now from Convex file storage
            snapshotFilename: alert.snapshotFilename,
          })) || []
      }
      isLoading={alertData === undefined}
    />
  </section>
)}
```

---

## Testing Checklist

### Edge (Offline Test)
- [ ] Snapshots save locally with correct naming: `alert_YYYYMMDD_HHMMSS.jpg`
- [ ] Cooldown timer prevents spam (5-second minimum)
- [ ] No lag in video stream (detector loop still runs fast)

### Edge + Backend (Integration Test)
- [ ] Set `BACKEND_ALERT_UPLOAD_URL` environment variable
- [ ] Trigger alert condition (EAR < 0.15 or high acceleration)
- [ ] Check logs: "Snapshot uploaded successfully"
- [ ] Verify image appears in Convex dashboard

### Frontend
- [ ] "Alert Snapshots" tab displays
- [ ] Images load and display correctly
- [ ] Confidence score bar visible
- [ ] Click to expand full-size viewer
- [ ] Emergency badge flashes red when alerts active

---

## Environment Variables Reference

### On Raspberry Pi
```bash
# .env or docker-compose.yml
export SERIAL_PORT="/dev/ttyUSB0"
export CAMERA_INDEX=0
export CONVEX_SITE_URL="https://your-convex-site.convex.site/"
export JEEPNEY_ID="your-unique-id"
export SNAPSHOT_COOLDOWN_SEC=5
export ALERT_COOLDOWN_SEC=10
export BACKEND_ALERT_UPLOAD_URL="https://your-convex-site.convex.site/api/upload-alert"
```

---

## Next Steps

1. **Immediate (MVP)**
   - [ ] Update edge detector with upload function
   - [ ] Deploy Convex HTTP endpoint
   - [ ] Test upload with manual alert trigger
   - [ ] Verify images appear on dashboard

2. **Week 1**
   - [ ] Add image compression (reduce file size)
   - [ ] Implement retry logic for failed uploads
   - [ ] Add upload progress logging

3. **Week 2**
   - [ ] Set up alert auto-cleanup (delete old images)
   - [ ] Add confidence score from model
   - [ ] Performance testing with 10+ vehicles

4. **Phase 2 (Optional)**
   - [ ] Migrate to AWS S3 for scalability
   - [ ] Add WebSocket for live metrics
   - [ ] Implement real-time video preview

---

## Troubleshooting

### Images not uploading
1. Check network: `ping your-convex-site.convex.site`
2. Verify URL in `BACKEND_ALERT_UPLOAD_URL`
3. Check Convex logs for HTTP errors
4. Fall back to local storage (should still work)

### High bandwidth usage
1. Reduce `SNAPSHOT_COOLDOWN_SEC` (currently 5s - fine)
2. Compress JPEG quality: `cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 75])`
3. Check for duplicate uploads (verify cooldown)

### Dashboard not showing images
1. Verify `imageUrl` is not null in query response
2. Check browser console for CORS errors
3. Ensure Convex file storage permissions allow public read

---

**Questions?** Refer to [DATA_SYNC_STRATEGY.md](./DATA_SYNC_STRATEGY.md) for architectural details.
