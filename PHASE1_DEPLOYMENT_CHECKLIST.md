# Phase 1 Deployment Checklist ✅

**Status**: Fully Implemented (April 5, 2026)

---

## What's Been Deployed

### ✅ Edge Enhancements (detector.py)
- **HTTP Upload Function**: `_upload_alert_snapshot()` - saves locally + uploads to backend
- **Environment Configuration**: `BACKEND_ALERT_UPLOAD_URL` - set this to enable uploads
- **Graceful Fallback**: If upload fails, falls back to local storage
- **Main Loop Integration**: Snapshot capture calls new upload function

### ✅ Backend (Convex)

#### Schema Updates (schema.ts)
```typescript
alerts: {
  + confidenceScore: number (0-1)
  + snapshotStorageId: string (file storage ID)
  + snapshotFilename: string (original filename)
  // existing fields preserved
}
```

#### HTTP Endpoint (http.ts)
```
POST /api/upload-alert
├─ Receives: multipart form data (image + metadata)
├─ Stores: Image in Convex file storage
└─ Returns: Alert ID + success confirmation
```

#### Queries & Mutations (alerts.ts)
- ✅ `insertAlert()` - now accepts `confidenceScore`
- ✅ `getActiveAlerts()` - returns alerts with `imageUrl` property
- ✅ `getAlertWithImage()` - fetch single alert with image URL

### ✅ Frontend (React)
- **AlertsGallery**: Uses real image URLs from Convex
- **EmergencyBadge**: Red pulsing indicator
- **Dashboard**: "Alert Snapshots" tab integrated

---

## 🚀 How to Deploy

### Step 1: Deploy Backend (Convex)
```bash
cd web/
npx convex deploy
```
This deploys:
- Updated schema with new image fields
- New HTTP endpoint for `/api/upload-alert`
- Updated alerts query with image URL generation

### Step 2: Get Your Convex Site URL
```bash
# After deployment, you'll see:
# Convex is now deployed at: https://your-meadow-1234.convex.site/
```

### Step 3: Update Edge Configuration
On your Raspberry Pi, set these environment variables:
```bash
export BACKEND_ALERT_UPLOAD_URL="https://your-meadow-1234.convex.site/api/upload-alert"
export ALERTS_DIR="./alerts"
export SNAPSHOT_COOLDOWN_SEC=5
```

Or in a `.env` file:
```env
BACKEND_ALERT_UPLOAD_URL=https://your-meadow-1234.convex.site/api/upload-alert
ALERTS_DIR=./alerts
SNAPSHOT_COOLDOWN_SEC=5
```

### Step 4: Rebuild & Deploy Frontend
```bash
cd web/
npm run build
npm run deploy  # Or: vercel deploy
```

### Step 5: Test the System
```bash
# On Raspberry Pi
python edge/detector.py

# In browser:
# 1. Go to dashboard
# 2. Trigger alert condition (lower EAR threshold in code temporarily)
# 3. Check "Alert Snapshots" tab
# 4. Verify image appears with confidence score
```

---

## 📊 Testing Checklist

### Edge Testing
```
✅ Detector prints: "[Alert] Snapshot saved locally: alert_20260405_143022.jpg"
✅ Files created in ./alerts/ directory with correct naming
✅ 5-second cooldown prevents image spam
   (Test by holding alert condition for 15+ seconds)
✅ No lag in video stream (detector loop still smooth)
```

### Network Testing
```
✅ Detector prints: "[Alert] Snapshot uploaded successfully: alert_*.jpg"
   OR: "[Alert] Upload failed (XXX): ..." if network issue
✅ Falls back to local if upload fails (check ./alerts/)
✅ HTTP request completes within 5 seconds
```

### Convex Testing
```bash
# In Convex dashboard (https://dashboard.convex.dev/)
✅ New alerts appear in "alerts" table
✅ "snapshotStorageId" field is populated
✅ "confidenceScore" field has value (0.7-1.0)
✅ File storage shows new images
```

### Frontend Testing
```
✅ Dashboard loads without errors
✅ "Alert Snapshots" tab appears in sidebar
✅ Tab shows gallery with recent alerts
✅ Images display (placeholder → real after upload)
✅ Confidence score shows as percentage
✅ Click thumbnail to expand full-size viewer
✅ Emergency badge (red, pulsing) when alerts active
```

---

## 🔍 Troubleshooting

### Issue: Images not uploading
**Symptoms**: Files save locally but not appearing on dashboard
**Solution**:
1. Check BACKEND_ALERT_UPLOAD_URL is set correctly
2. Verify URL is accessible: `curl -v https://your-url/api/upload-alert`
3. Check Convex logs for HTTP errors:
   ```bash
   npx convex logs
   ```

### Issue: Images uploading but not appearing in gallery
**Symptoms**: Convex shows alert records but imageUrl is null
**Solution**:
1. Verify `snapshotStorageId` in Convex dashboard
2. Try hitting `/api/upload-alert` with test image using curl:
   ```bash
   curl -F "image=@test.jpg" \
        -F "jeepneyId=abc123" \
        -F "alertType=DROWSY" \
        -F "timestamp=1712282400" \
        -F "filename=test.jpg" \
        https://your-url/api/upload-alert
   ```

### Issue: Gallery shows empty image cards
**Symptoms**: Card layout loads but no images visible
**Solution**:
1. Check browser console for network errors
2. Verify image storage permissions in Convex
3. Ensure alert records have `snapshotStorageId` (not null)
4. Clear browser cache: `Ctrl+Shift+Delete`

### Issue: Upload timeout/slow response
**Symptoms**: Edge logs show slow uploads or timeouts
**Solution**:
1. Reduce image quality:
   ```python
   # In detector.py, modify the encode:
   _, jpeg_buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
   ```
2. Reduce resolution or frame size
3. Check network bandwidth: `iftop` or `speedtest`

---

## 📈 Performance Baseline

After Phase 1 deployment, you should see:

| Metric | Target | How to Measure |
|--------|--------|---|
| Snapshot capture time | <10ms | Check detector.py logs |
| Local save latency | <50ms | File write time |
| Upload latency | <2s | "[Alert] Snapshot uploaded" log |
| Dashboard image load | <1s | Browser DevTools Network tab |
| Gallery render | <500ms | React profiler |
| Emergency badge animation | Smooth 60fps | Visual inspection |

---

## 🔗 Configuration Reference

### Environment Variables

**On Raspberry Pi** (edge/detector.py):
```bash
BACKEND_ALERT_UPLOAD_URL     # Required for Phase 1
ALERTS_DIR                    # Optional, default ./alerts
SNAPSHOT_COOLDOWN_SEC         # Optional, default 5
```

**On Convex** (web/convex/):
- No env vars needed - all hardcoded for now

**On Frontend** (web/src/):
- Uses Convex API automatically
- No additional env vars needed

---

## 📚 Code Reference

### Edge Upload Function
**File**: `edge/detector.py` (lines 194-269)
```python
def _upload_alert_snapshot(...):
    # 1. Saves locally
    # 2. Encodes as JPEG
    # 3. POSTs to backend with metadata
    # 4. Returns filename if successful
```

### Backend Upload Endpoint
**File**: `web/convex/http.ts` (lines 83-139)
```typescript
POST /api/upload-alert
  ├─ Parse multipart form
  ├─ Store image in file storage
  ├─ Create alert record
  └─ Return success + alertId
```

### Query with Image URLs
**File**: `web/convex/alerts.ts` (lines 23-47)
```typescript
export const getActiveAlerts = query({
  // Automatically fetches imageUrl for each alert
  // Returns: Alert & imageUrl
})
```

---

## 🎯 Success Criteria

Phase 1 is successful when:

1. ✅ Edge captures snapshots locally
2. ✅ Edge uploads snapshots to Convex HTTP endpoint
3. ✅ Convex stores images in file storage
4. ✅ Convex generates signed URLs for image access
5. ✅ Frontend gallery displays images in real-time
6. ✅ Images update as new alerts occur
7. ✅ No lag in detector loop
8. ✅ Graceful fallback if upload fails

---

## 🚀 Next Phase (Phase 2)

After Phase 1 is stable:

1. Add image compression (reduce 50KB → 20KB)
2. Implement retry logic for failed uploads
3. Add image cleanup (delete after 30 days)
4. Add confidence scores from model (not mocked)
5. Performance testing with 10+ vehicles

---

## ✅ Deployment Sign-Off

- [x] Edge enhanced with upload capability
- [x] Convex schema updated
- [x] HTTP endpoint created and tested
- [x] Frontend updated to use real image URLs
- [x] Documentation completed
- [ ] Deployed to production ← **Next step**
- [ ] Tested end-to-end
- [ ] Team trained

---

**Questions?** Check [PHASE1_IMPLEMENTATION.md](./PHASE1_IMPLEMENTATION.md) for detailed code walkthroughs.

**Deploy now**: `cd web && npx convex deploy && npm run build`
