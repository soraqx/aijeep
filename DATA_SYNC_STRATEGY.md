# AI-JEEP Alert Snapshot Data Sync Strategy

## Overview
Your Raspberry Pi edge device captures alert snapshots to `./alerts/` directory. The web dashboard needs to display these snapshots in real-time. Below are the recommended sync strategies with trade-offs analysis.

---

## Strategy 1: Direct HTTP File Upload (⭐ Recommended for MVP)

### How It Works
- **Edge**: When a snapshot is captured, immediately POST the `.jpg` file to a backend endpoint
- **Backend**: Receive and store in Convex file storage or cloud storage (Firebase, AWS S3)
- **Dashboard**: Fetch metadata + image URLs from Convex, render in gallery

### Pros
✅ **Simplest to implement** - No file polling or complex sync logic  
✅ **Real-time delivery** - Images available within seconds  
✅ **Stateless edge** - Pi doesn't need to maintain file lists  
✅ **Bandwidth efficient** - Only send on actual anomaly  
✅ **Works on cellular networks** (4G/LTE) - Important for Jeepneys  

### Cons
❌ Edge needs network connection at time of capture (may fail on poor connection)  
❌ Network overhead for file transfer  
❌ Requires more complex edge code (multipart form upload)

### Implementation (Python - Edge Side)
```python
import requests

def _upload_alert_snapshot(
    frame: any,
    jeepney_id: str,
    alert_type: str,
    timestamp: int,
    backend_url: str = "http://your-backend/upload-alert"
) -> bool:
    """
    Upload alert snapshot directly to backend.
    """
    try:
        # Encode frame as JPEG in memory
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            return False
        
        files = {'image': ('alert.jpg', buffer.tobytes(), 'image/jpeg')}
        data = {
            'jeepneyId': jeepney_id,
            'alertType': alert_type,
            'timestamp': timestamp
        }
        
        resp = requests.post(
            backend_url,
            files=files,
            data=data,
            timeout=5.0
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"[Upload] Error: {e}")
        # Fall back to local storage if upload fails
        return False

# Usage in main detector loop:
if pred in HAZARDOUS_PREDICTIONS:
    if ret and frame is not None and (now_mono - last_snapshot_saved_mono >= SNAPSHOT_COOLDOWN_SEC):
        timestamp = int(time.time())
        # Try to upload first
        uploaded = _upload_alert_snapshot(
            frame,
            JEEPNEY_ID,
            ALERT_TYPE_MAP.get(pred, "UNKNOWN"),
            timestamp
        )
        # Fall back to local save if upload fails
        if not uploaded:
            _save_alert_snapshot(frame, ALERTS_DIR, timestamp)
        last_snapshot_saved_mono = now_mono
```

### Backend Endpoint (Node.js / Convex HTTP)
```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { api } from "./_generated/api";

export const http = httpRouter();

http.route({
  path: "/upload-alert",
  method: "POST",
  handler: async (request) => {
    try {
      const formData = await request.formData();
      const image = formData.get("image") as File;
      const jeepneyId = formData.get("jeepneyId") as string;
      const alertType = formData.get("alertType") as string;
      const timestamp = parseInt(formData.get("timestamp") as string);

      // Store in Convex file storage
      const imageData = await image.arrayBuffer();
      const fileId = await ctx.storage.store(
        new Blob([imageData], { type: "image/jpeg" })
      );

      // Create alert record with file reference
      await ctx.db.insert("alerts", {
        jeepneyId,
        alertType,
        timestamp,
        snapshotFileId: fileId,
        isResolved: false,
        _creationTime: Date.now()
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400 }
      );
    }
  }
});
```

---

## Strategy 2: WebSocket Real-Time Streaming

### How It Works
- Open persistent WebSocket connection between edge → backend
- Stream snapshot data in frames or as base64
- Dashboard receives updates via WebSocket subscription

### Pros
✅ **True real-time** - Instant delivery  
✅ **Handles network interruptions** gracefully with reconnection  
✅ **Can stream live video feed** if needed later  
✅ **Two-way communication** - backend can send commands to edge  

### Cons
❌ **More complex** to implement and maintain  
❌ **Higher CPU/memory** on Raspberry Pi (persistent connection)  
❌ **Firewall issues** - WebSocket may be blocked by cellular networks  
❌ **Server scaling** - Requires connection pooling for many vehicles  

### When to Use
- **Later phase**: If you need live video streaming or remote edge commands
- **High-frequency alerts**: If alerts happen constantly

---

## Strategy 3: Local File Sync via rsync/SSH (Not Recommended)

### How It Works
- Edge periodically syncs `./alerts/` folder to server via rsync/SSH
- Dashboard reads files from server storage

### Pros
✅ Good for **archival/backup**  
✅ Works with **poor network** (resumable transfers)

### Cons
❌ **Polling overhead** - Check every 5-10 seconds for changes  
❌ **Not real-time** - Minutes of delay possible  
❌ **Firewall issues** - SSH ports blocked on 4G  
❌ **Pi resource heavy** - SSH/rsync consumes memory  

### When to Use
- **Never** for real-time alerts - only for offline backup

---

## Strategy 4: Cloud Storage with Signed URLs (AWS S3 / Firebase)

### How It Works
- Edge uploads directly to cloud bucket (S3, GCS, Firebase Storage)
- Backend stores reference (filename, URL)
- Dashboard fetches images using signed URLs

### Pros
✅ **Scalable** - Cloud handles storage/CDN  
✅ **Secure** - Signed URLs with expiration  
✅ **Global reach** - Fast CDN delivery  
✅ **Monitoring** - Cloud logging/analytics  

### Cons
❌ **Higher cost** - Storage + transfer costs  
❌ **Dependency** on cloud provider  
❌ **Setup complexity** - IAM roles, bucket policies  
❌ **Latency** - Upload to cloud slightly slower than local server

### When to Use
- **Scaling to 100+ vehicles**
- **High reliability requirement** (cloud redundancy)
- **Budget available** for cloud services

---

## 🎯 Recommended Approach: Hybrid Strategy 1 + Cloud

### Phase 1 (MVP - NOW)
Use **Strategy 1**: Direct HTTP upload to Convex with **local fallback**
- Upload snapshots to backend immediately after capture
- Store in Convex file storage (free tier)
- If upload fails → save locally until connection restored
- Dashboard queries Convex for metadata + image URLs

### Phase 2 (Scaling)
Migrate to **Strategy 4**: AWS S3 with signed URLs
- Edge uploads directly to S3 (faster, less backend load)
- Convex stores S3 URLs + metadata
- Implement cleanup: delete S3 files after 30 days (cost savings)

### Phase 3 (Real-Time Features)
Add **Strategy 2**: WebSocket for live features
- Live edge status/metrics
- Remote edge configuration commands
- Optional: low-res live video preview

---

## Implementation Checklist for Phase 1

### Edge (detector.py)
- [x] Save snapshots with timestamped names → `alert_YYYYMMDD_HHMMSS.jpg`
- [ ] Add HTTP upload function (POST multipart to backend)
- [ ] Gracefully handle upload failures (local fallback)
- [ ] Implement HTTP request timeout (5-10s)

### Backend (Convex)
- [ ] Create HTTP POST endpoint: `/upload-alert`
- [ ] Parse multi-part form data (image + metadata)
- [ ] Store image in Convex file storage (`ctx.storage.store()`)
- [ ] Create alert record with file reference
- [ ] Add query: `getAlertWithImage()` to fetch image URL

### Frontend (React)
- [x] Create `AlertsGallery.tsx` component
- [x] Create `EmergencyBadge.tsx` component
- [x] Add "Alert Snapshots" tab to dashboard
- [ ] Fetch alerts from Convex: `alerts.getActiveAlerts()`
- [ ] Generate image URLs using Convex file URL query
- [ ] Implement image lazy-loading for performance

---

## Code Examples

### Convex: Fetch Alert with Image URL
```typescript
// convex/alerts.ts
export const getAlertWithImage = query({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) return null;

    let imageUrl = null;
    if (alert.snapshotFileId) {
      imageUrl = await ctx.storage.getUrl(alert.snapshotFileId);
    }

    return {
      ...alert,
      imageUrl
    };
  }
});
```

### React: Render AlertsGallery with Real Data
```typescript
const alerts = useQuery(api.alerts.getActiveAlerts, {});

const alertSnapshots = (alerts || [])
  .filter(a => !a.isResolved)
  .map(a => ({
    id: a._id,
    jeepneyId: a.jeepneyId,
    alertType: a.alertType as "DROWSY" | "HARSH_BRAKING",
    timestamp: a.timestamp,
    confidenceScore: a.confidenceScore || 0.85,
    snapshotUrl: a.imageUrl // From Convex file storage
  }));

<AlertsGallery alerts={alertSnapshots} isLoading={alerts === undefined} />
```

---

## Performance Considerations

### Edge (Raspberry Pi)
- Snapshots are **compressed JPEGs** (efficient)
- Upload runs in **background** (doesn't block detector loop)
- Cooldown timer **prevents spam** (5-second minimum)
- Local fallback prevents **data loss** on network drops

### Network
- Single 640×480 JPEG: **~30-50KB**
- With 5-second cooldown: **~10KB/sec per vehicle**
- 10 vehicles at peak: **100KB/sec** (manageable on 4G)

### Backend Storage
- 1 month of alerts @ 100 JPEGs/day: **~150MB**
- Convex free tier: **~$0** for storage + queries

---

## Summary

| Strategy | Speed | Complexity | Cost | Reliability |
|----------|-------|-----------|------|-------------|
| **1. HTTP Upload (MVP)** | ⚡ Real-time | 🟡 Medium | 💰 Free | 🟡 Good |
| **2. WebSocket** | ⚡⚡ Instant | 🔴 Hard | 💰 Free | 🟢 Great |
| **3. rsync/SSH** | 🐢 Slow | 🟡 Medium | 💰 Free | 🔴 Poor |
| **4. Cloud Storage** | ⚡ Real-time | 🟡 Medium | 💸 Paid | 🟢 Excellent |

**Choose MVP (Strategy 1) for now** → Migrate to Cloud (Strategy 4) at scale.
