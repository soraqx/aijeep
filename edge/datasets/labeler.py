import pandas as pd

print("--- AI-JEEP: Zero-Touch Kinematic Labeler ---")

# 1. Load your extracted 6,000-row chunk
input_file = 'training_set.csv'
try:
    df = pd.read_csv(input_file)
    print(f"Loaded {len(df)} rows from {input_file}.")
except FileNotFoundError:
    print(f"Error: {input_file} not found. Check your filename!")
    exit()

# 2. Create the Label column and default everything to 0 (Normal)
if 'Label' not in df.columns:
    df['Label'] = 0

# 3. Define the hardware realities
FPS = 5
PADDING_FRAMES = 7  # Adds ~1.5 seconds before and after the spike to capture the whole brake

# 4. Find the pure physics spikes
print("Scanning for harsh braking signatures...")
# Adjust -0.6 if your sensor was highly sensitive
condition = (df['accel_y'] < -0.6) & (df['speed_kmh'] > 10.0)
spike_indices = df.index[condition].tolist()

# 5. Apply the padded labels
events_labeled = 0
for idx in spike_indices:
    # Ensure we don't go out of bounds of the dataframe
    start_idx = max(0, idx - PADDING_FRAMES)
    end_idx = min(len(df) - 1, idx + PADDING_FRAMES)
    
    # Check if it's already part of an ongoing labeled event to avoid over-counting in the print
    if df.loc[idx, 'Label'] == 0:
        events_labeled += 1
        
    # Apply Class 2 to the padded window
    df.loc[start_idx:end_idx, 'Label'] = 2

# 6. Save the final, ready-to-train dataset
output_file = 'labeled_kinematic_data.csv'
df.to_csv(output_file, index=False)

print("\n--- Labeling Complete ---")
print(f"Detected and padded ~{events_labeled} distinct braking events.")
print(f"Total Class 0 (Normal) rows: {len(df[df['Label'] == 0])}")
print(f"Total Class 2 (Harsh Brake) rows: {len(df[df['Label'] == 2])}")
print(f"\nSaved as {output_file}. Ready for model training!")