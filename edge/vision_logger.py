#!/usr/bin/env python3
"""Log vision EAR data from webcam for AI-JEEP training.

This script captures webcam frames, runs MediaPipe Face Mesh, computes EAR,
and logs to CSV for 45 minutes. Simulate drowsy behavior during recording.
"""

import cv2
import math
import time
import csv

try:
    import mediapipe as mp
except ImportError:
    raise ImportError("MediaPipe not installed. Run: pip install mediapipe")

CAMERA_INDEX = 0
OUTPUT_FILE = "human_vision.csv"
DURATION_SEC = 45 * 60  # 45 minutes
FPS = 15


def load_face_mesh():
    """Load MediaPipe Face Mesh (classic Solutions API)."""
    try:
        import mediapipe as mp
        return mp.solutions.face_mesh
    except AttributeError as e:
        raise RuntimeError(
            "MediaPipe Face Mesh needs the classic Solutions API (mediapipe.solutions). "
            "Newer slim Windows wheels (e.g. 0.10.30+) do not include it.\n"
            "From your venv:\n"
            "  python -m pip uninstall -y mediapipe mediapipe-nightly\n"
            '  python -m pip install --no-cache-dir "mediapipe==0.10.21" "protobuf>=3.20,<5"'
        ) from e


def compute_ear(face_landmarks) -> float:
    """Compute Eye Aspect Ratio from Face Mesh landmarks."""
    left_eye = [33, 160, 158, 133, 153, 144]
    right_eye = [362, 385, 387, 263, 373, 380]

    def ear_for_eye(eye_indices) -> float:
        i1, i2, i3, i4, i5, i6 = eye_indices
        p1 = (face_landmarks[i1].x, face_landmarks[i1].y)
        p2 = (face_landmarks[i2].x, face_landmarks[i2].y)
        p3 = (face_landmarks[i3].x, face_landmarks[i3].y)
        p4 = (face_landmarks[i4].x, face_landmarks[i4].y)
        p5 = (face_landmarks[i5].x, face_landmarks[i5].y)
        p6 = (face_landmarks[i6].x, face_landmarks[i6].y)

        denom = math.dist(p1, p4)
        if denom <= 0 or not math.isfinite(denom):
            return math.nan

        a = math.dist(p2, p6)
        b = math.dist(p3, p5)
        if not (math.isfinite(a) and math.isfinite(b)):
            return math.nan

        return (a + b) / (2.0 * denom)

    ear_left = ear_for_eye(left_eye)
    ear_right = ear_for_eye(right_eye)

    if math.isfinite(ear_left) and math.isfinite(ear_right):
        return (ear_left + ear_right) / 2.0
    elif math.isfinite(ear_left):
        return ear_left
    elif math.isfinite(ear_right):
        return ear_right
    else:
        return math.nan


def main() -> None:
    print("Starting vision EAR logging...")

    cap = cv2.VideoCapture(CAMERA_INDEX)
    mp_face_mesh = load_face_mesh()
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    
        raise RuntimeError(f"Failed to open webcam (index={CAMERA_INDEX}).")

    face_mesh = load_face_mesh()

    with open(OUTPUT_FILE, "w", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=["timestamp", "earValue"])
        writer.writeheader()

        start_time = time.time()
        logged_count = 0
        while time.time() - start_time < DURATION_SEC:
            ret, frame = cap.read()
            if ret:
                try:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = face_mesh.process(rgb)
                    if results.multi_face_landmarks:
                        face_landmarks = results.multi_face_landmarks[0].landmark
                        ear_value = compute_ear(face_landmarks)
                        if math.isfinite(ear_value):
                            writer.writerow({
                                "timestamp": time.time(),
                                "earValue": ear_value,
                            })
                            logged_count += 1
                            if logged_count % 100 == 0:
                                print(f"Logged {logged_count} vision frames...")
                except Exception as e:
                    print(f"Vision processing error: {e}")
            time.sleep(1 / FPS)

    cap.release()
    face_mesh.close()
    print(f"Vision logging complete. {logged_count} frames saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()