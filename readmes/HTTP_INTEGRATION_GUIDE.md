# HTTP Integration Guide: Python Edge → Convex Backend

## Overview
This document describes the corrected HTTP endpoints and payload formats for sending telemetry and alert snapshots from the Python edge detector to your Convex backend.

---

## 🔧 Issues Fixed

### Issue 1: Field Name Mismatch
**Problem:** Python script was sending `jeepney_id`, `lat`, `lon`, `speed` but backend expected `jeepneyId`, `gps`, `earValue`, `accelX/Y/Z`.

**Solution:** Updated `http.ts` to map Python payload fields to Convex schema fields.

### Issue 2: Image Upload Format
**Problem:** Backend was expecting multipart form data, but Python script was sending raw binary bytes.

**Solution:** Updated `http.ts` to accept raw image bytes with HTTP headers containing metadata.

### Issue 3: Timestamp Format  
**Problem:** Python sends Unix timestamps in seconds; Convex expects milliseconds.

**Solution:** Backend now converts timestamps automatically: `Math.floor(timestamp * 1000)`.

### Issue 4: Missing CORS Headers
**Problem:** CORS preflight requests (OPTIONS) weren't properly handled.

**Solution:** Added OPTIONS handlers for all endpoints with proper CORS headers.

---

## ✅ Corrected Endpoints

### 1. `/api/telemetry` (POST)
**Purpose:** Send real-time vehicle telemetry from edge device

**Python Request:**
```python
payload = {
    "jeepney_id": "jd764sesm49a13m9kpm9b25k99865z01",
    "timestamp": time.time(),  # Unix seconds (e.g., 1715376553)
    "lat": 14.599512,
    "lon": 121.009496,
    "speed": 45,  # km/h
    "status": "NORMAL",  # Optional: NORMAL, DROWSY, HARSH_BRAKING
    "accelY": 2.5,  # Optional: from IMU
    "earValue": 0.42  # Optional: from vision model
}

req = urllib.request.Request(
    "https://exciting-meadowlark-962.convex.site/api/telemetry",
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
urllib.request.urlopen(req, timeout=3.0)
```

**Backend Processing:**
- ✅ Accepts raw JSON
- ✅ Maps `jeepney_id` → `jeepneyId` 
- ✅ Maps `lat`, `lon` → `gps` (stored as "lat,lon")
- ✅ Maps `speed` → `speedKmh`
- ✅ Converts timestamp from seconds → milliseconds
- ✅ Stores in `telemetry` table

**Success Response:**
```json
{
    "success": true,
    "telemetryId": "k123456789abcdef"
}
```

**Error Response (400):**
```json
{
    "success": false,
    "error": "Missing required fields: jeepney_id, lat, lon, timestamp"
}
```

---

### 2. `/api/upload-alert` (POST)  
**Purpose:** Send alert snapshot images with context

**Python Request:**
```python
frame = ...  # cv2 image object
alert_type = "DROWSY"  # or "HARSH_BRAKING"
timestamp = time.time()

_, buffer = cv2.imencode('.jpg', frame)

req = urllib.request.Request(
    "https://exciting-meadowlark-962.convex.site/api/upload-alert",
    data=buffer.tobytes(),  # Raw binary JPEG
    headers={
        'Content-Type': 'image/jpeg',
        'X-Alert-Type': alert_type,
        'X-Jeepney-Id': JEEPNEY_ID,
        'X-Timestamp': str(int(timestamp))  # Unix seconds
    }
)
urllib.request.urlopen(req, timeout=5.0)
```

**Backend Processing:**
- ✅ Reads raw image bytes from request body
- ✅ Extracts metadata from HTTP headers:
  - `X-Alert-Type` → alert type (DROWSY, HARSH_BRAKING, etc.)
  - `X-Jeepney-Id` → vehicle identifier
  - `X-Timestamp` → event timestamp (auto-converts seconds → ms)
- ✅ Stores image file in Convex storage
- ✅ Creates alert record with reference to stored image

**Success Response:**
```json
{
    "success": true,
    "alertId": "v123456789abcdef",
    "storageId": "s123456789abcdef",
    "message": "Snapshot received and stored"
}
```

**Error Response (400):**
```json
{
    "error": "Missing required headers: X-Alert-Type, X-Jeepney-Id, X-Timestamp"
}
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ PYTHON EDGE DEVICE (detect.py)                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Every 1 second (TELEMETRY_INTERVAL_SEC):               │
│     └─> telemetry_worker() sends JSON payload              │
│         POST /api/telemetry                                 │
│                                                              │
│  2. On alert (ALERT_COOLDOWN_SEC = 10s):                   │
│     └─> snapshot_worker() sends raw image bytes            │
│         POST /api/upload-alert                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│ CONVEX BACKEND (http.ts)                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /api/telemetry (POST)                                      │
│  ├─ Parse JSON payload                                      │
│  ├─ Validate required fields                                │
│  ├─ Map Python fields → Convex schema                       │
│  └─ INSERT into telemetry table ✓                           │
│                                                              │
│  /api/upload-alert (POST)                                   │
│  ├─ Extract headers (X-Alert-Type, X-Jeepney-Id, etc.)     │
│  ├─ Read raw image bytes                                    │
│  ├─ Store in Convex file storage                            │
│  └─ INSERT into alerts table with image reference ✓         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ CONVEX DATABASE                                             │
├─────────────────────────────────────────────────────────────┤
│ telemetry table:      [jeepneyId, gps, speed, timestamp] ✓ │
│ alerts table:         [jeepneyId, alertType, snapshot] ✓   │
│ storage:              [image files] ✓                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐍 Updated Python Code Snippets

### Telemetry Sender (Already Correct)
```python
def telemetry_worker():
    while True:
        payload = telemetry_queue.get()
        if payload is None: break 
        try:
            req = urllib.request.Request(
                TELEMETRY_URL,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            urllib.request.urlopen(req, timeout=3.0)
        except Exception:
            pass
        telemetry_queue.task_done()
```

**Expected payload from main loop:**
```python
telemetry_payload = {
    "jeepney_id": JEEPNEY_ID,
    "timestamp": current_time,  # Unix seconds from time.time()
    "status": alert_type,
    "lat": latest_physics.get('lat', 0),
    "lon": latest_physics.get('lon', 0),
    "speed": latest_physics.get('speed_kmh', 0)
}
telemetry_queue.put(telemetry_payload)
```

### Image Upload Sender (FIXED)
```python
def snapshot_worker():
    while True:
        task = snapshot_queue.get()
        if task is None: break 
        frame, alert_type, timestamp = task  # ← Added timestamp
        try:
            _, buffer = cv2.imencode('.jpg', frame)
            # Send raw image bytes with required headers
            req = urllib.request.Request(
                BACKEND_ALERT_UPLOAD_URL,
                data=buffer.tobytes(),
                headers={
                    'Content-Type': 'image/jpeg',
                    'X-Alert-Type': alert_type,
                    'X-Jeepney-Id': JEEPNEY_ID,
                    'X-Timestamp': str(int(timestamp))  # ← Added headers
                }
            )
            urllib.request.urlopen(req, timeout=5.0)
            print(f"[Network] Uploaded {alert_type} snapshot!")
        except Exception as e:
            print(f"[Network Error] Snapshot upload failed: {e}")
        snapshot_queue.task_done()
```

### Main Loop Alert Trigger (FIXED)
```python
if alert_triggered and (current_time - last_snapshot_time > SNAPSHOT_COOLDOWN):
    print(f"⚠️ DANGER DETECTED: {alert_type}! Uploading snapshot...")
    snapshot_queue.put((frame.copy(), alert_type, current_time))  # ← Pass timestamp
    last_snapshot_time = current_time
```

---

## 🧪 Testing Checklist

### Local Testing (Before Deployment)

1. **Telemetry Endpoint:**
   ```bash
   curl -X POST https://exciting-meadowlark-962.convex.site/api/telemetry \
     -H "Content-Type: application/json" \
     -d '{
       "jeepney_id": "jd764sesm49a13m9kpm9b25k99865z01",
       "timestamp": 1715376553,
       "lat": 14.599512,
       "lon": 121.009496,
       "speed": 45
     }'
   ```
   
   **Expected:** `{"success": true, "telemetryId": "..."}`

2. **Image Upload Endpoint:**
   ```bash
   curl -X POST https://exciting-meadowlark-962.convex.site/api/upload-alert \
     -H "Content-Type: image/jpeg" \
     -H "X-Alert-Type: DROWSY" \
     -H "X-Jeepney-Id: jd764sesm49a13m9kpm9b25k99865z01" \
     -H "X-Timestamp: 1715376553" \
     --data-binary @alert.jpg
   ```
   
   **Expected:** `{"success": true, "alertId": "...", "storageId": "..."}`

3. **CORS Preflight:**
   ```bash
   curl -X OPTIONS https://exciting-meadowlark-962.convex.site/api/telemetry \
     -H "Origin: *" -v
   ```
   
   **Expected:** Status 204 with CORS headers

---

## 🚀 Deployment Checklist

- [ ] Updated `detect.py` with new snapshot_worker() code
- [ ] Updated main alert trigger to pass `current_time` to snapshot queue
- [ ] Confirmed JEEPNEY_ID matches a valid Convex jeepney document
- [ ] Tested telemetry endpoint locally
- [ ] Tested image upload endpoint locally
- [ ] Verified CONVEX_SITE_URL is correct
- [ ] Redeployed Python edge script to Raspberry Pi
- [ ] Checked Convex logs for successful requests
- [ ] Verified telemetry appears in database
- [ ] Verified alert images appear in storage

---

## 📝 Convex Schema Reference

### `telemetry` table fields:
```typescript
{
  jeepneyId: Id,           // e.g., "jd764sesm49a13m9kpm9b25k99865z01"
  gps: string,             // e.g., "14.599512,121.009496"
  earValue: number,        // 0-1 eye aspect ratio
  accelX: number,          // m/s²
  accelY: number,          // m/s²
  accelZ: number,          // m/s²
  speedKmh: number,        // vehicle speed
  timestamp: number,       // Unix milliseconds
  isAlertRelated: boolean  // optional flag
}
```

### `alerts` table fields:
```typescript
{
  jeepneyId: Id,              // vehicle ID
  alertType: string,          // "DROWSY", "HARSH_BRAKING", etc.
  timestamp: number,          // Unix milliseconds
  confidenceScore: number,    // 0.0-1.0
  snapshotStorageId: string,  // Convex storage reference
  snapshotFilename: string,   // original filename
  isResolved: boolean         // alert status
}
```

---

## ⚠️ Common Issues & Solutions

### Issue: 404 Not Found
**Cause:** Route path doesn't match or endpoint not deployed
**Solution:** 
- Verify CONVEX_SITE_URL is correct
- Check Convex deployment logs
- Ensure http.ts routes are deployed

### Issue: 400 Bad Request - Missing Fields
**Cause:** Python payload missing required fields
**Solution:** 
- Verify jeepney_id, lat, lon, timestamp are present
- Check field name casing (Python sends snake_case)

### Issue: 400 Bad Request - Missing Headers
**Cause:** Image upload missing X-Alert-Type, X-Jeepney-Id, or X-Timestamp
**Solution:** 
- Use lowercase header names in Python (urllib normalizes them)
- Verify all three headers are present

### Issue: Data Not Appearing in Database
**Cause:** Mutation failing or response not confirming
**Solution:** 
- Check Convex dashboard logs
- Verify JEEPNEY_ID is a valid document ID
- Test with curl first (see Testing section)

---

## 📖 References

- [Convex HTTP Routes](https://docs.convex.dev/http)
- [Convex File Storage](https://docs.convex.dev/file-storage)
- [Python urllib.request](https://docs.python.org/3/library/urllib.request.html)

