import pandas as pd
import numpy as np
import time

# --- SIMULATION PARAMETERS ---
FPS = 15
MINUTES = 5
TOTAL_FRAMES = FPS * 60 * MINUTES
START_TIME = time.time()

# 1. Initialize the Base DataFrame
timestamps = [START_TIME + (i * (1/FPS)) for i in range(TOTAL_FRAMES)]
df = pd.DataFrame({'timestamp': timestamps})

# 2. Simulate Baseline (Normal Driving)
# Normal EAR: ~0.30 with slight flutter
df['earValue'] = np.random.normal(loc=0.32, scale=0.02, size=TOTAL_FRAMES)
# Normal Blinks (Drop to <0.1 for 3-4 frames randomly)
blink_indices = np.random.choice(df.index, size=int(TOTAL_FRAMES * 0.05), replace=False)
for idx in blink_indices:
    if idx + 3 < TOTAL_FRAMES:
        df.loc[idx:idx+3, 'earValue'] = np.random.normal(0.05, 0.01, size=4)

# Kinematics: 1g on Z-axis (gravity + jeepney vibration), ~0g on X and Y
df['accel_x'] = np.random.normal(loc=0.0, scale=0.05, size=TOTAL_FRAMES) # Minor lane swaying
df['accel_y'] = np.random.normal(loc=0.0, scale=0.08, size=TOTAL_FRAMES) # Minor pedal adjustments
df['accel_z'] = np.random.normal(loc=0.98, scale=0.15, size=TOTAL_FRAMES) # High variance jeepney rattle

# GPS: Constant speed, perfect lock, stationary coords for simplicity
df['speed_kmh'] = np.random.normal(loc=45.0, scale=2.0, size=TOTAL_FRAMES)
df['sats'] = 8
df['lat'] = 14.7937
df['lon'] = 120.8791
df['Label'] = 0

# --- INJECTING EVENTS (ANOMALIES) ---

# EVENT 1: Drowsy Episodes (Class 1) - Extended eye closure
# Let's inject 4 drowsy events, each lasting 2 seconds (30 frames)
drowsy_starts = [1000, 2500, 3200, 4100]
for start in drowsy_starts:
    end = start + (2 * FPS)
    # EAR drops significantly and stays low
    df.loc[start:end, 'earValue'] = np.random.normal(loc=0.08, scale=0.03, size=(end-start)+1)
    # Label as Drowsy
    df.loc[start:end, 'Label'] = 1

# EVENT 2: Harsh Braking (Class 2) - Sudden negative Y acceleration
# Let's inject 3 braking events, each lasting 1.5 seconds
brake_starts = [500, 1800, 3800]
for start in brake_starts:
    end = start + int(1.5 * FPS)
    # Massive spike in negative longitudinal acceleration
    df.loc[start:end, 'accel_y'] = np.random.normal(loc=-0.85, scale=0.1, size=(end-start)+1)
    # Speed drops rapidly
    df.loc[start:end, 'speed_kmh'] = np.linspace(45.0, 10.0, num=(end-start)+1)
    # Label as Distracted/Harsh Brake
    df.loc[start:end, 'Label'] = 2

# --- FINAL CLEANUP & EXPORT ---
# Ensure values don't break physics (e.g., EAR shouldn't be negative)
df['earValue'] = df['earValue'].clip(lower=0.0)

# Save to CSV
filename = 'raw_dataset.csv'
df.to_csv(filename, index=False)
print(f"Successfully generated {filename} with {TOTAL_FRAMES} frames.")
print(f"Class Distribution:\n{df['Label'].value_counts()}")