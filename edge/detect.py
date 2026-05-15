"""
AI-JEEP Edge Detector (Threaded Dual-Model Architecture)
* Feature-Matched to train_vision.py and train_kinematic.py
"""

import os

import cv2
import serial
import json
import joblib
import time
import math
import numpy as np
import threading
import queue
from collections import deque
import urllib.request
import urllib.error

try:
    import mediapipe as mp
except ImportError:
    raise ImportError("MediaPipe not installed. Run: pip install mediapipe")

# ==========================================
# CONFIGURATION
# ==========================================
SERIAL_PORT = os.environ.get("SERIAL_PORT", "/dev/ttyUSB0")
BAUDRATE = int(os.environ.get("SERIAL_BAUDRATE", "115200"))
CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", "0"))

CONVEX_SITE_URL = os.environ.get("CONVEX_SITE_URL", "https://exciting-meadowlark-962.convex.site")
JEEPNEY_ID = os.environ.get("JEEPNEY_ID", "jd764sesm49a13m9kpm9b25k99865z01")

TELEMETRY_INTERVAL_SEC = float(os.environ.get("TELEMETRY_INTERVAL_SEC", "1.0"))
ALERT_COOLDOWN_SEC = float(os.environ.get("ALERT_COOLDOWN_SEC", "10.0"))
SNAPSHOT_COOLDOWN_SEC = float(os.environ.get("SNAPSHOT_COOLDOWN_SEC", "5.0"))
REQUEST_TIMEOUT_SEC = float(os.environ.get("REQUEST_TIMEOUT_SEC", "5.0"))

CONVEX_SITE_URL = CONVEX_SITE_URL.rstrip("/")
TELEMETRY_URL = f"{CONVEX_SITE_URL}/api/telemetry"
ALERTS_URL = f"{CONVEX_SITE_URL}/api/alerts"

ALERTS_DIR = os.environ.get("ALERTS_DIR", "./alerts")
if not os.path.isabs(ALERTS_DIR):
    ALERTS_DIR = os.path.join(os.path.dirname(__file__), ALERTS_DIR)

VISION_MODEL_PATH = os.environ.get("VISION_MODEL_PATH", "vision_rfc.pkl")
KINEMATIC_MODEL_PATH = os.environ.get("KINEMATIC_MODEL_PATH", "kinematic_rfc.pkl")
# Instead of hardcoding it, build it from the base URL:
BACKEND_ALERT_UPLOAD_URL = os.environ.get("BACKEND_ALERT_UPLOAD_URL", f"{CONVEX_SITE_URL}/api/upload-alert")


# --- Matched to Training Script Windows ---
FPS_VISION = 15
FPS_KINEMATIC = 5

VISION_BASELINE_FRAMES = 15 * FPS_VISION  # 15 seconds to calibrate (225 frames)
VISION_WINDOW_MIN = 1 * FPS_VISION        # 1-second rolling min (15 frames)
VISION_WINDOW_VAR = 3 * FPS_VISION        # 3-second rolling var (45 frames)

PHYSICS_WINDOW = 3 * FPS_KINEMATIC        # 3-second rolling max/std (15 frames)

# ==========================================
# THREAD 1: BACKGROUND SERIAL READER
# ==========================================
class ESP32Reader(threading.Thread):
    def __init__(self, port, baudrate):
        super().__init__()
        self.port = port
        self.baudrate = baudrate
        self.ser = None
        self.running = True
        self.latest_data = None
        self.lock = threading.Lock()

    def run(self):
        while self.ser is None and self.running:
            try:
                self.ser = serial.Serial(self.port, self.baudrate, timeout=1.0)
                print(f"[Hardware] Connected to ESP32 on {self.port}")
            except serial.SerialException:
                time.sleep(2)

        while self.running:
            try:
                line = self.ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    data = json.loads(line)
                    # Only store valid dict data (not raw numbers or other types)
                    if isinstance(data, dict):
                        with self.lock:
                            self.latest_data = data
                    else:
                        print(f"[Hardware Warning] Received non-dict data from ESP32: {type(data).__name__} = {data}")
            except Exception as e:
                print(f"[Hardware Error] JSON parse failed: {e}") 

    def get_latest(self):
        with self.lock:
            return self.latest_data

    def stop(self):
        self.running = False
        if self.ser:
            self.ser.close()

# ==========================================
# NETWORK WORKERS (QUEUES)
# ==========================================
telemetry_queue = queue.Queue()
snapshot_queue = queue.Queue()

def telemetry_worker():
    while True:
        payload = telemetry_queue.get()
        if payload is None: break 
        try:
            req = urllib.request.Request(TELEMETRY_URL, data=json.dumps(payload).encode('utf-8'),
                                          headers={'Content-Type': 'application/json'})
            response = urllib.request.urlopen(req, timeout=3.0)
            response_body = response.read().decode('utf-8')
            print(f"[Network] Telemetry sent: {response.status} - {response_body}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"[Network Error] HTTP {e.code} - {error_body}")
            print(f"[Network Debug] Payload: {json.dumps(payload)}")
        except Exception as e:
            print(f"[Network Error] {type(e).__name__}: {e}")
        telemetry_queue.task_done()

def snapshot_worker():
    while True:
        task = snapshot_queue.get()
        if task is None: break 
        frame, alert_type, timestamp = task
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
                    'X-Timestamp': str(int(timestamp))
                }
            )
            urllib.request.urlopen(req, timeout=5.0)
            print(f"[Network] Uploaded {alert_type} snapshot!")
        except Exception as e:
            print(f"[Network Error] Snapshot upload failed: {e}")
        snapshot_queue.task_done()

threading.Thread(target=telemetry_worker, daemon=True).start()
threading.Thread(target=snapshot_worker, daemon=True).start()

# ==========================================
# HELPER FUNCTIONS
# ==========================================
def compute_ear(landmarks):
    # Left eye
    left_v1 = math.dist([landmarks[160].x, landmarks[160].y], [landmarks[144].x, landmarks[144].y])
    left_v2 = math.dist([landmarks[158].x, landmarks[158].y], [landmarks[153].x, landmarks[153].y])
    left_h  = math.dist([landmarks[33].x,  landmarks[33].y],  [landmarks[133].x, landmarks[133].y])
    ear_left = (left_v1 + left_v2) / (2.0 * left_h)

    # Right eye
    right_v1 = math.dist([landmarks[385].x, landmarks[385].y], [landmarks[380].x, landmarks[380].y])
    right_v2 = math.dist([landmarks[387].x, landmarks[387].y], [landmarks[373].x, landmarks[373].y])
    right_h  = math.dist([landmarks[362].x, landmarks[362].y], [landmarks[263].x, landmarks[263].y])
    ear_right = (right_v1 + right_v2) / (2.0 * right_h)

    return (ear_left + ear_right) / 2.0

# ==========================================
# MAIN LOOP
# ==========================================
def main():
    print("[System] Loading Dual AI Models...")
    try:
        rf_vision = joblib.load(VISION_MODEL_PATH)
        rf_kinematic = joblib.load(KINEMATIC_MODEL_PATH)
    except Exception as e:
        raise RuntimeError(f"Failed to load models. Error: {e}")

    print("[System] Initializing Hardware...")
    esp32_thread = ESP32Reader(SERIAL_PORT, BAUDRATE)
    esp32_thread.start()

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        raise RuntimeError("Webcam not found!")

    mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    # Memory Buffers
    accel_y_buffer = deque(maxlen=PHYSICS_WINDOW)
    
    ear_calibration_buffer = []
    ear_baseline = None
    n_ear_buffer = deque(maxlen=VISION_WINDOW_VAR)
    
    last_snapshot_time = 0
    last_telemetry_time = 0
    SNAPSHOT_COOLDOWN = 5.0
    
    # Latest sensor values for telemetry
    latest_accel_x = 0.0
    latest_accel_y = 0.0
    latest_accel_z = 0.0
    latest_ear = 0.0 

    print("\n[System] AI-JEEP Active.")
    print(">>> DRIVER CALIBRATION REQUIRED: Please look forward normally for 15 seconds. <<<\n")

    # Frame rate throttling
    target_frame_time = 1.0 / FPS_VISION  # ~66ms for 15 fps

    # Default tracking variables for telemetry
    current_ear = 0.0
    current_rolling_max = 0.0
    current_rolling_std = 0.0

    try:
        while True:
            frame_start = time.time()
            current_time = frame_start
            alert_triggered = False
            alert_type = "NORMAL"

            # ----------------------------------------
            # 1. KINEMATIC AI PIPELINE 
            # ----------------------------------------
            latest_physics = esp32_thread.get_latest()
            if latest_physics and isinstance(latest_physics, dict):
                accel_y = latest_physics.get('accel_y', 0)
                speed = latest_physics.get('speed_kmh', 0)
                
                # Store latest accel values for telemetry
                latest_accel_x = latest_physics.get('accel_x', 0.0)
                latest_accel_y = accel_y
                latest_accel_z = latest_physics.get('accel_z', 0.0)
                
                accel_y_buffer.append(accel_y)

                if len(accel_y_buffer) == PHYSICS_WINDOW:
                    # Calculate features to match train_kinematic.py exactly
                    rolling_max = max(accel_y_buffer)
                    # ddof=1 ensures match with pandas .std()
                    rolling_std = np.std(accel_y_buffer, ddof=1) if len(accel_y_buffer) > 1 else 0.0 
                    # Update tracking variables for telemetry
                    current_rolling_max = rolling_max
                    current_rolling_std = rolling_std
                    
                    # Order: ["Accel_rolling_max", "Accel_rolling_std", "speed_kmh"]
                    X_phys = np.array([[rolling_max, rolling_std, speed]]) 
                    phys_pred = rf_kinematic.predict(X_phys)[0]
                    
                    if phys_pred == 2: 
                        alert_triggered = True
                        alert_type = "HARSH_BRAKING"

            # ----------------------------------------
            # 2. VISION AI PIPELINE
            # ----------------------------------------
            ret, frame = cap.read()
            if ret:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = mp_face_mesh.process(rgb_frame)

                if results.multi_face_landmarks:
                    landmarks = results.multi_face_landmarks[0].landmark
                    ear = compute_ear(landmarks)
                    
                    if math.isfinite(ear):
                        current_ear = ear   # Update for telemetry
                        # PHASE A: Calibration (Establish Baseline)
                        if ear_baseline is None:
                            ear_calibration_buffer.append(ear)
                            if len(ear_calibration_buffer) % 15 == 0:
                                print(f"Calibrating Vision... {len(ear_calibration_buffer)}/{VISION_BASELINE_FRAMES} frames")
                            
                            if len(ear_calibration_buffer) == VISION_BASELINE_FRAMES:
                                ear_baseline = sum(ear_calibration_buffer) / len(ear_calibration_buffer)
                                print(f"\n✅ CALIBRATION COMPLETE! Baseline EAR: {ear_baseline:.3f}")
                                print("System is now actively monitoring driver state.\n")
                            
                        # PHASE B: Active Prediction
                        else:
                            n_ear = ear / ear_baseline
                            n_ear_buffer.append(n_ear)

                            if len(n_ear_buffer) == VISION_WINDOW_VAR:
                                # Get the rolling min (last 15 items in the 45-item deque)
                                recent_15 = list(n_ear_buffer)[-VISION_WINDOW_MIN:]
                                rolling_min = min(recent_15)
                                
                                # Get the rolling variance (ddof=1 matches pandas .var())
                                rolling_var = np.var(n_ear_buffer, ddof=1)
                                
                                # Order: ["N_EAR", "N_EAR_rolling_min", "N_EAR_rolling_var"]
                                X_vis = np.array([[n_ear, rolling_min, rolling_var]])
                                vis_pred = rf_vision.predict(X_vis)[0]

                                if vis_pred == 1: 
                                    alert_triggered = True
                                    alert_type = "DROWSY"

            # ----------------------------------------
            # 3. ALERT & TELEMETRY DISPATCH
            # ----------------------------------------
            if latest_physics and isinstance(latest_physics, dict):
                # FIX 1: Only send data once per second to save the CPU!
                if current_time - last_telemetry_time >= TELEMETRY_INTERVAL_SEC:
                    telemetry_payload = {
                        "jeepney_id": JEEPNEY_ID,
                        "timestamp": current_time,
                        "status": alert_type,
                        "lat": latest_physics.get('lat', 0),
                        "lon": latest_physics.get('lon', 0),
                        "speed": latest_physics.get('speed_kmh', 0),
                        "accel_x": latest_accel_x,
                        "accel_y": latest_accel_y,
                        "accel_z": latest_accel_z,
                        "ear_value": current_ear,
                        "rolling_max": current_rolling_max,
                        "rolling_std": current_rolling_std
                    }
                    telemetry_queue.put(telemetry_payload)
                    last_telemetry_time = current_time

            # Frame rate throttling: maintain ~15 fps for vision processing
            frame_elapsed = time.time() - frame_start
            sleep_time = target_frame_time - frame_elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\n[System] Shutting down safely...")
    finally:
        esp32_thread.stop()
        esp32_thread.join()
        telemetry_queue.put(None) 
        snapshot_queue.put(None)
        cap.release()
        mp_face_mesh.close()

if __name__ == "__main__":
    main()