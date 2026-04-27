#!/usr/bin/env python3
"""Log kinematic data from ESP32 serial for AI-JEEP training.

This script reads JSON payloads from the ESP32 over serial and logs them to CSV
for 45 minutes. Run this during a real jeepney ride to capture authentic physics.
"""

import json
import time
import csv
import serial

SERIAL_PORT = "/dev/ttyUSB0"  # Adjust for your setup (e.g., COM3 on Windows)
BAUDRATE = 115200
OUTPUT_FILE = "jeepney_physics.csv"
DURATION_SEC = 45 * 60  # 45 minutes


def parse_sensor_line(line: str) -> dict | None:
    """Parse JSON from ESP32 into a dict."""
    if not line:
        return None
    try:
        data = json.loads(line)
        return {
            "timestamp": time.time(),
            "accel_x": float(data.get("accel_x", 0.0)),
            "accel_y": float(data.get("accel_y", 0.0)),
            "accel_z": float(data.get("accel_z", 0.0)),
            "speed_kmh": float(data.get("speed_kmh", 0.0)),
            "lat": float(data.get("lat", 0.0)),
            "lon": float(data.get("lon", 0.0)),
            "sats": int(data.get("sats", 0)),
        }
    except (json.JSONDecodeError, ValueError, TypeError):
        return None


def main() -> None:
    print("Starting kinematic data logging...")

    try:
        ser = serial.Serial(SERIAL_PORT, BAUDRATE, timeout=1.0)
        print(f"Connected to {SERIAL_PORT} @ {BAUDRATE}")
    except serial.SerialException as e:
        raise RuntimeError(f"Serial connection failed: {e}") from e

    with open(OUTPUT_FILE, "w", newline="") as csvfile:
        writer = csv.DictWriter(
            csvfile,
            fieldnames=["timestamp", "accel_x", "accel_y", "accel_z", "speed_kmh", "lat", "lon", "sats"]
        )
        writer.writeheader()

        start_time = time.time()
        logged_count = 0
        while time.time() - start_time < DURATION_SEC:
            try:
                raw_line = ser.readline().decode("utf-8", errors="ignore").strip()
                parsed = parse_sensor_line(raw_line)
                if parsed:
                    writer.writerow(parsed)
                    logged_count += 1
                    if logged_count % 100 == 0:
                        print(f"Logged {logged_count} kinematic frames...")
            except serial.SerialException as e:
                print(f"Serial read error: {e}")
                time.sleep(0.1)
            time.sleep(0.01)  # Throttle

    ser.close()
    print(f"Kinematic logging complete. {logged_count} frames saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()