import pandas as pd

print("--- AI-JEEP: Physics Action Finder (5 FPS) ---")

# Load your truncated, pristine physics dataset
try:
    df = pd.read_csv('final_jeepney_physics.csv')
    print(f"Successfully loaded {len(df)} rows.")
except FileNotFoundError:
    print("Error: 'final_jeepney_physics.csv' not found in this directory.")
    exit()

# The new hardware reality
FPS = 5 

# --- SEARCH: Harsh Braking Events (Class 2) ---
print("\nScanning for Harsh Braking Events...")
# Look for massive spikes in the Y-axis (or magnitude) while speed > 10 km/h
# Adjust -0.6 to match your MPU6050's specific sensitivity if needed
df['is_hard_brake'] = (df['accel_y'] < -0.6) & (df['speed_kmh'] > 10.0)

brake_indices = df.index[df['is_hard_brake']].tolist()

if brake_indices:
    # Group continuous frames into events
    events = []
    start = brake_indices[0]
    for i in range(1, len(brake_indices)):
        if brake_indices[i] != brake_indices[i-1] + 1:
            events.append((start, brake_indices[i-1]))
            start = brake_indices[i]
    events.append((start, brake_indices[-1]))
    
    print(f"\nFound {len(events)} potential Harsh Braking episodes!")
    print("--------------------------------------------------")
    for e in events:
        # Calculate the actual minute mark to help you find the best 20-min window
        start_sec = e[0] / FPS
        start_min = int(start_sec // 60)
        rem_sec = int(start_sec % 60)
        
        print(f"Event at Row {e[0]} to {e[1]}  (Approx Minute {start_min}:{rem_sec:02d})")
else:
    print("\nNo harsh braking events found at this threshold. Try lowering the -0.6g threshold slightly.")

print("\n--------------------------------------------------")
print("NEXT STEP: Pick a 20-minute window (6,000 rows) that contains most of these events.")