import pandas as pd

print("--- AI-JEEP: Smart Vision Labeler ---")

# 1. Load the raw math data
input_file = 'human_vision.csv'
try:
    df = pd.read_csv(input_file)
    print(f"Loaded {len(df)} rows from {input_file}.")
except FileNotFoundError:
    print(f"Error: {input_file} not found.")
    exit()

# 2. Set default label to 0 (Normal)
df['Label'] = 0

# 3. YOUR GROUND TRUTH DATA GOES HERE
# Converted into pure seconds. (Distractions strictly excluded to preserve EAR math)
drowsy_events_seconds = [
    (849, 857),   # 14:09 - 14:17
    (863, 866),   # 14:23 - 14:26
    (871, 873),   # 14:31 - 14:33
    (920, 928),   # 15:20 - 15:28
    (1071, 1073), # 17:51 - 17:53
    (1075, 1082)  # 17:55 - 18:02
]

# 4. The Hardware Reality Math
FPS = 15

print("\nApplying Ground Truth Labels...")
events_labeled = 0

for start_sec, end_sec in drowsy_events_seconds:
    # Convert human seconds to machine rows
    start_row = int(start_sec * FPS)
    end_row = int(end_sec * FPS)
    
    # Failsafe: Don't go past the end of the spreadsheet
    start_row = max(0, start_row)
    end_row = min(len(df) - 1, end_row)
    
    # Apply Class 1 (Drowsy)
    df.loc[start_row:end_row, 'Label'] = 1
    events_labeled += 1
    
    print(f" -> Marked seconds {start_sec}-{end_sec} (Rows {start_row} to {end_row}) as Drowsy.")

# 5. Save the final, ready-to-train dataset
output_file = 'labeled_vision_data.csv'
df.to_csv(output_file, index=False)

print("\n--- Labeling Complete ---")
print(f"Successfully mapped {events_labeled} micro-sleep events.")
print(f"Total Class 0 (Normal) rows: {len(df[df['Label'] == 0])}")
print(f"Total Class 1 (Drowsy) rows: {len(df[df['Label'] == 1])}")
print(f"\nSaved as '{output_file}'. Ready for the Vision Model Trainer!")