# AI-JEEP

AI-JEEP is an AIoT public transport safety monitoring system with:

- `edge/`: Python services for Raspberry Pi, webcam, and ESP32 integration
- `web/`: React + Vite + TypeScript dashboard with Convex backend

## Monorepo Layout

- Keep hardware/ML code inside `edge/`
- Keep dashboard code inside `web/`
- Deploy the `web/` directory to Vercel by setting it as the Root Directory

## 🚀 Phase 1: Alert Snapshot System (Ready to Deploy)

### Features
- ✅ Real-time snapshot capture on anomaly detection (EAR < 0.15, high acceleration)
- ✅ 5-second cooldown prevents image spam
- ✅ HTTP upload to Convex backend with local fallback
- ✅ Dashboard "Alert Snapshots" gallery with images & confidence scores
- ✅ Red pulsing emergency badge when alerts active
- ✅ Full-screen image viewer modal

### Quick Deploy
```bash
# 1. Deploy backend
cd web/ && npx convex deploy

# 2. Set environment (on Raspberry Pi)
export BACKEND_ALERT_UPLOAD_URL="https://your-site.convex.site/api/upload-alert"

# 3. Deploy frontend
npm run build && npm run deploy

# 4. Test
python edge/detector.py
```

👉 **See [DEPLOY_NOW.md](./DEPLOY_NOW.md) for complete deployment guide**

### Files Changed
- ✏️ `edge/detector.py` - HTTP upload with local fallback
- ✏️ `web/convex/schema.ts` - Image storage fields
- ✏️ `web/convex/http.ts` - `/api/upload-alert` endpoint
- ✏️ `web/convex/alerts.ts` - Image URL queries
- ✏️ `web/src/pages/DashboardPage.tsx` - Real image integration

### Key Architecture
```
Raspberry Pi → POST JPEG → Convex Backend → File Storage
                                 ↓
                          Dashboard Gallery ← Real-time sync
```

## Documentation

- **[DEPLOY_NOW.md](./DEPLOY_NOW.md)** - 30-second quick start
- **[PHASE1_DEPLOYMENT_CHECKLIST.md](./PHASE1_DEPLOYMENT_CHECKLIST.md)** - Full testing & deployment guide
- **[PHASE1_IMPLEMENTATION.md](./PHASE1_IMPLEMENTATION.md)** - Detailed code walkthrough
- **[DATA_SYNC_STRATEGY.md](./DATA_SYNC_STRATEGY.md)** - Architecture & strategy comparison
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick lookup guide
