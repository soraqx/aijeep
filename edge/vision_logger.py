import cv2
import math
import time
import csv
import mediapipe as mp

print("--- AI-JEEP: Vision Data Logger & Video Recorder ---")

# --- CONFIGURATION ---
CAMERA_INDEX = 0
OUTPUT_CSV = "human_vision.csv"
OUTPUT_VIDEO = "vision_ground_truth.mp4"
DURATION_SEC = 20 * 60  # 20 Minutes (Highlight Reel)
FPS = 15

def _distance(p1, p2):
    """Calculates Euclidean distance between two MediaPipe landmarks."""
    return math.hypot(p1.x - p2.x, p1.y - p2.y)

def compute_ear(landmarks):
    """Computes the Eye Aspect Ratio (EAR) to detect drowsiness."""
    try:
        left_h = _distance(landmarks[362], landmarks[263])
        left_v1 = _distance(landmarks[385], landmarks[380])
        left_v2 = _distance(landmarks[387], landmarks[373])
        if left_h == 0: left_h = 0.001 
        left_ear = (left_v1 + left_v2) / (2.0 * left_h)

        right_h = _distance(landmarks[33], landmarks[133])
        right_v1 = _distance(landmarks[160], landmarks[144])
        right_v2 = _distance(landmarks[158], landmarks[153])
        if right_h == 0: right_h = 0.001
        right_ear = (right_v1 + right_v2) / (2.0 * right_h)

        return (left_ear + right_ear) / 2.0
    except IndexError:
        return 0.0

def main():
    print(f"Target Duration: {DURATION_SEC // 60} minutes at {FPS} FPS")

    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print(f"Error: Could not open webcam (index={CAMERA_INDEX}).")
        return

    # --- INITIALIZE VIDEO RECORDER ---
    # Get the default camera resolution
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Use mp4v codec for standard MP4 recording
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') 
    out_video = cv2.VideoWriter(OUTPUT_VIDEO, fourcc, FPS, (frame_width, frame_height))

    print("Webcam initialized. Starting recording in 3 seconds...")
    time.sleep(3)

    # Open CSV for logging
    with open(OUTPUT_CSV, "w", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=["timestamp", "earValue"])
        writer.writeheader()

        start_time = time.time()
        logged_count = 0

        while (time.time() - start_time) < DURATION_SEC:
            loop_start = time.time()
            ret, frame = cap.read()
            
            if not ret:
                print("Warning: Dropped a webcam frame.")
                continue

            # 1. SAVE THE RAW VIDEO FRAME (Your Ground Truth)
            out_video.write(frame)

            # 2. CALCULATE AND SAVE THE MATH
            try:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = face_mesh.process(rgb_frame)

                if results.multi_face_landmarks:
                    face_landmarks = results.multi_face_landmarks[0].landmark
                    ear_value = compute_ear(face_landmarks)
                    
                    if math.isfinite(ear_value) and ear_value > 0:
                        writer.writerow({
                            "timestamp": time.time(),
                            "earValue": ear_value
                        })
                        logged_count += 1
                        
                        if logged_count % 150 == 0:
                            elapsed_min = (time.time() - start_time) // 60
                            print(f"Logged {logged_count} frames (Minute {int(elapsed_min)} / 20)")
            except Exception as e:
                print(f"Vision processing error: {e}")

            # Frame Limiter
            elapsed = time.time() - loop_start
            sleep_time = (1.0 / FPS) - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    # Cleanup
    cap.release()
    out_video.release() # CRITICAL: Finalize the video file
    face_mesh.close()
    
    print("\n--- Vision logging complete ---")
    print(f"Successfully saved {logged_count} math frames to '{OUTPUT_CSV}'.")
    print(f"Successfully saved physical ground truth to '{OUTPUT_VIDEO}'.")

if __name__ == "__main__":
    main()