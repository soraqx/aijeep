"""
AI-JEEP edge detector.

Responsibilities:
- Read accelerometer data from ESP32 over serial.
- Capture webcam frames and run MediaPipe Face Mesh.
- Compute Eye Aspect Ratio (EAR) from facial landmarks.
- Fuse [earValue, accelX, accelY, accelZ] and run Random Forest inference.
- Send telemetry and (throttled) alerts to a Convex backend via REST.
"""

from __future__ import annotations
from utils import get_model_path
import math
import os
import time
import json
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime

import cv2
import joblib
try:
    import requests  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    requests = None  # type: ignore[assignment]
import serial
import urllib.error
import urllib.request


def _parse_accel_line(line: str) -> Optional[Tuple[float, float, float]]:
    """
    Expected format from ESP32:
      AccelX,AccelY,AccelZ
    """
    if not line:
        return None
    parts = [p.strip() for p in line.split(",")]
    if len(parts) < 3:
        return None
    try:
        ax = float(parts[0])
        ay = float(parts[1])
        az = float(parts[2])
        if not (math.isfinite(ax) and math.isfinite(ay) and math.isfinite(az)):
            return None
        return ax, ay, az
    except ValueError:
        return None


def _load_face_mesh_module():
    """
    Return the Face Mesh submodule (mediapipe.solutions.face_mesh).

    PyPI Windows wheels from about 0.10.30+ ship only the Tasks API and omit
    the classic Solutions stack, so Face Mesh is unavailable there.
    """
    import mediapipe as mp

    try:
        return mp.solutions.face_mesh
    except AttributeError as e:
        raise RuntimeError(
            "MediaPipe Face Mesh needs the classic Solutions API (mediapipe.solutions). "
            "Newer slim Windows wheels (e.g. 0.10.30+) do not include it.\n"
            "From your venv:\n"
            "  python -m pip uninstall -y mediapipe mediapipe-nightly\n"
            '  python -m pip install --no-cache-dir "mediapipe==0.10.21" "protobuf>=3.20,<5"'
        ) from e


def _dist2(p: Tuple[float, float], q: Tuple[float, float]) -> float:
    # Euclidean distance in normalized space.
    return math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2)


def _compute_ear_from_face_landmarks(face_landmarks) -> float:
    """
    Compute Eye Aspect Ratio (EAR) using MediaPipe Face Mesh landmarks.

    Common EAR landmark mapping for FaceMesh:
    - Left eye:  (33, 160, 158, 133, 153, 144)
    - Right eye: (362, 385, 387, 263, 373, 380)
    """
    # (p1, p2, p3, p4, p5, p6) where:
    # EAR = (dist(p2,p6) + dist(p3,p5)) / (2 * dist(p1,p4))
    left = (33, 160, 158, 133, 153, 144)
    right = (362, 385, 387, 263, 373, 380)

    def ear_for_eye(idxs) -> float:
        i1, i2, i3, i4, i5, i6 = idxs
        p1 = (face_landmarks[i1].x, face_landmarks[i1].y)
        p2 = (face_landmarks[i2].x, face_landmarks[i2].y)
        p3 = (face_landmarks[i3].x, face_landmarks[i3].y)
        p4 = (face_landmarks[i4].x, face_landmarks[i4].y)
        p5 = (face_landmarks[i5].x, face_landmarks[i5].y)
        p6 = (face_landmarks[i6].x, face_landmarks[i6].y)

        denom = _dist2(p1, p4)
        if denom <= 0.0 or not math.isfinite(denom):
            return math.nan

        a = _dist2(p2, p6)
        b = _dist2(p3, p5)
        if not (math.isfinite(a) and math.isfinite(b)):
            return math.nan

        return (a + b) / (2.0 * denom)

    ear_left = ear_for_eye(left)
    ear_right = ear_for_eye(right)

    if math.isfinite(ear_left) and math.isfinite(ear_right):
        return 0.5 * (ear_left + ear_right)
    if math.isfinite(ear_left):
        return ear_left
    if math.isfinite(ear_right):
        return ear_right
    return math.nan


def _safe_post(
    session: requests.Session,
    url: str,
    payload: dict,
    timeout_sec: float,
) -> None:
    try:
        if requests is not None and session is not None:
            # Preferred implementation (requests).
            resp = session.post(url, json=payload, timeout=timeout_sec)
            if resp.status_code >= 400:
                print(f"[HTTP] POST failed {resp.status_code}: {resp.text[:300]}")
            return

        # Fallback implementation (urllib) when `requests` isn't installed.
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        req = urllib.request.Request(url=url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                status = getattr(resp, "status", 200)
                body = resp.read().decode("utf-8", errors="ignore")
                if status >= 400:
                    print(f"[HTTP] POST failed {status}: {body[:300]}")
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="ignore")
            except Exception:
                pass
            print(f"[HTTP] POST failed {e.code}: {body[:300]}")
    except Exception as e:
        # Network drops on 4G should not kill the loop.
        print(f"[HTTP] POST error: {e.__class__.__name__}: {e}")


def _save_alert_snapshot(
    frame: any,
    alerts_dir: str,
    timestamp: Optional[int] = None,
) -> Optional[str]:
    """
    Save a snapshot to the alerts directory with a timestamped filename.
    
    Args:
        frame: The OpenCV frame (BGR format) to save.
        alerts_dir: Path to the alerts directory.
        timestamp: Unix timestamp. If None, uses current time.
    
    Returns:
        Filename (without path) if successful, None otherwise.
    """
    try:
        Path(alerts_dir).mkdir(parents=True, exist_ok=True)
        
        if timestamp is None:
            timestamp = int(time.time())
        
        dt = datetime.utcfromtimestamp(timestamp)
        filename = dt.strftime("alert_%Y%m%d_%H%M%S.jpg")
        filepath = os.path.join(alerts_dir, filename)
        
        success = cv2.imwrite(filepath, frame)
        if success:
            print(f"[Alert] Snapshot saved: {filename}")
            return filename
        else:
            print(f"[Alert] Failed to write snapshot: {filepath}")
            return None
    except Exception as e:
        print(f"[Alert] Snapshot save error: {e.__class__.__name__}: {e}")
        return None


def _upload_alert_snapshot(
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
        # Save locally first
        Path(alerts_dir).mkdir(parents=True, exist_ok=True)
        
        if timestamp is None:
            timestamp = int(time.time())
        
        dt = datetime.utcfromtimestamp(timestamp)
        filename = dt.strftime("alert_%Y%m%d_%H%M%S.jpg")
        filepath = os.path.join(alerts_dir, filename)
        
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


def main() -> None:
    print("AI-JEEP edge detector starting...")

    # ---------------------------
    # Configuration (placeholders)
    # ---------------------------
    SERIAL_PORT = os.environ.get("SERIAL_PORT", "/dev/ttyUSB0")
    BAUDRATE = int(os.environ.get("SERIAL_BAUDRATE", "115200"))
    CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", "0"))

    # Set these for your Convex deployment.
    CONVEX_SITE_URL = os.environ.get("CONVEX_SITE_URL", "https://exciting-meadowlark-962.convex.site/")
    JEEPNEY_ID = os.environ.get("JEEPNEY_ID", "jd7aq3ebnz073yjsw4fp4d293x8439p7")

    TELEMETRY_INTERVAL_SEC = float(os.environ.get("TELEMETRY_INTERVAL_SEC", "1.0"))
    ALERT_COOLDOWN_SEC = float(os.environ.get("ALERT_COOLDOWN_SEC", "10.0"))
    SNAPSHOT_COOLDOWN_SEC = float(os.environ.get("SNAPSHOT_COOLDOWN_SEC", "5.0"))
    REQUEST_TIMEOUT_SEC = float(os.environ.get("REQUEST_TIMEOUT_SEC", "5.0"))

    CONVEX_SITE_URL = CONVEX_SITE_URL.rstrip("/")
    TELEMETRY_URL = f"{CONVEX_SITE_URL}/api/telemetry"
    ALERTS_URL = f"{CONVEX_SITE_URL}/api/alerts"

    # Determine alerts directory (use relative./alerts or absolute path)
    ALERTS_DIR = os.environ.get("ALERTS_DIR", "./alerts")
    if not os.path.isabs(ALERTS_DIR):
        ALERTS_DIR = os.path.join(os.path.dirname(__file__), ALERTS_DIR)

    # Alert snapshot upload configuration
    BACKEND_ALERT_UPLOAD_URL = "https://exciting-meadowlark-962.convex.site/api/upload-alert"

    GPS_DUMMY = "14.5995, 120.9842"

    ALERT_TYPE_MAP = {
        1: "DROWSY",
        2: "HARSH_BRAKING",
    }
    HAZARDOUS_PREDICTIONS = {1, 2}

    # ---------------------------
    # Load ML model
    # ---------------------------
    model_path = get_model_path()
    
    try:
        model = joblib.load(model_path)
    except Exception as e:
        raise RuntimeError(f"Failed to load model: {e.__class__.__name__}: {e}") from e

    # ---------------------------
    # Init serial connection
    # ---------------------------
    ser: Optional[serial.Serial] = None
    last_serial_attempt_mono = 0.0

    def try_open_serial() -> Optional[serial.Serial]:
        try:
            s = serial.Serial(SERIAL_PORT, BAUDRATE, timeout=1.0)
            time.sleep(0.2)
            print(f"[Serial] Connected on {SERIAL_PORT} @ {BAUDRATE}")
            return s
        except serial.SerialException as e:
            print(f"[Serial] Open failed: {e.__class__.__name__}: {e}")
            return None

    # ---------------------------
    # Init webcam
    # ---------------------------
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open webcam (index={CAMERA_INDEX}).")

    # ---------------------------
    # Init MediaPipe Face Mesh
    # ---------------------------
    mp_face_mesh = _load_face_mesh_module()
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    session = requests.Session() if requests is not None else None

    # ---------------------------
    # State for fusion + cooldowns
    # ---------------------------
    latest_ear: float = 0.0
    latest_accelX: float = 0.0
    latest_accelY: float = 0.0
    latest_accelZ: float = 0.0

    last_telemetry_sent_mono = 0.0
    last_alert_sent_mono = 0.0
    last_alert_pred: Optional[int] = None
    last_snapshot_saved_mono = 0.0

    # ---------------------------
    # Main loop
    # ---------------------------
    try:
        while True:
            loop_start_mono = time.monotonic()

            # ---- Serial read (non-fatal) ----
            if ser is None:
                if loop_start_mono - last_serial_attempt_mono >= 5.0:
                    last_serial_attempt_mono = loop_start_mono
                    ser = try_open_serial()

            if ser is not None:
                try:
                    raw_line = ser.readline().decode("utf-8", errors="ignore").strip()
                    parsed = _parse_accel_line(raw_line)
                    if parsed is not None:
                        latest_accelX, latest_accelY, latest_accelZ = parsed
                except serial.SerialException as e:
                    print(f"[Serial] Read error: {e.__class__.__name__}: {e}")
                    try:
                        ser.close()
                    except Exception:
                        pass
                    ser = None
                except Exception as e:
                    print(f"[Serial] Unexpected error: {e.__class__.__name__}: {e}")

            # ---- Vision read + EAR compute (non-fatal) ----
            ret, frame = cap.read()
            if ret and frame is not None:
                try:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    res = face_mesh.process(rgb)
                    if res.multi_face_landmarks:
                        face_landmarks = res.multi_face_landmarks[0].landmark
                        ear_value = _compute_ear_from_face_landmarks(face_landmarks)
                        if math.isfinite(ear_value):
                            latest_ear = float(ear_value)
                except Exception as e:
                    print(f"[Vision] Processing error: {e.__class__.__name__}: {e}")

            # ---- ML inference ----
            fused = [
                float(latest_ear),
                float(latest_accelX),
                float(latest_accelY),
                float(latest_accelZ),
            ]

            try:
                pred = int(model.predict([fused])[0])
            except Exception as e:
                print(f"[ML] Inference error: {e.__class__.__name__}: {e}")
                pred = 0

            now_mono = time.monotonic()

            # ---- Telemetry: send every second ----
            if now_mono - last_telemetry_sent_mono >= TELEMETRY_INTERVAL_SEC:
                timestamp = int(time.time())
                telemetry_payload = {
                    "jeepneyId": JEEPNEY_ID,
                    "gps": GPS_DUMMY,
                    "earValue": fused[0],
                    "accelX": fused[1],
                    "accelY": fused[2],
                    "accelZ": fused[3],
                    "timestamp": timestamp,
                }
                _safe_post(
                    session=session,
                    url=TELEMETRY_URL,
                    payload=telemetry_payload,
                    timeout_sec=REQUEST_TIMEOUT_SEC,
                )
                last_telemetry_sent_mono = now_mono

            # ---- Alerts: cooldown if state persists ----
            if pred in HAZARDOUS_PREDICTIONS:
                should_send = False
                if last_alert_pred != pred:
                    should_send = True
                else:
                    if now_mono - last_alert_sent_mono >= ALERT_COOLDOWN_SEC:
                        should_send = True

                if should_send:
                    timestamp = int(time.time())
                    alert_payload = {
                        "jeepneyId": JEEPNEY_ID,
                        "alertType": ALERT_TYPE_MAP.get(pred, "UNKNOWN"),
                        "timestamp": timestamp,
                    }
                    _safe_post(
                        session=session,
                        url=ALERTS_URL,
                        payload=alert_payload,
                        timeout_sec=REQUEST_TIMEOUT_SEC,
                    )
                    last_alert_sent_mono = now_mono
                    last_alert_pred = pred

            # ---- Snapshot capture with optional upload ----
            if pred in HAZARDOUS_PREDICTIONS:
                if ret and frame is not None and (now_mono - last_snapshot_saved_mono >= SNAPSHOT_COOLDOWN_SEC):
                    timestamp = int(time.time())
                    _upload_alert_snapshot(
                        frame,
                        ALERTS_DIR,
                        JEEPNEY_ID,
                        ALERT_TYPE_MAP.get(pred, "UNKNOWN"),
                        timestamp,
                        upload_url=BACKEND_ALERT_UPLOAD_URL,
                        timeout_sec=REQUEST_TIMEOUT_SEC,
                    )
                    last_snapshot_saved_mono = now_mono

            # Small sleep to avoid maxing the CPU.
            elapsed = time.monotonic() - loop_start_mono
            if elapsed < 0.01:
                time.sleep(0.01)
    except KeyboardInterrupt:
        print("Shutting down (KeyboardInterrupt)...")
    finally:
        try:
            if ser is not None:
                ser.close()
        except Exception:
            pass
        try:
            cap.release()
        except Exception:
            pass
        try:
            face_mesh.close()
        except Exception:
            pass
        try:
            if session is not None:
                session.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
