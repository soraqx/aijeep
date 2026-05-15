import pandas as pd
import glob

print("--- AI-JEEP: Rebuilding Fractured Dataset ---")

# 1. Grab all the fragmented CSVs in the current folder
files = sorted(glob.glob("*.csv")) 
print(f"Found {len(files)} files to merge: {files}")

# 2. Read and store them
dataframes = []
for file in files:
    df = pd.read_csv(file)
    dataframes.append(df)
    print(f"Loaded {file} - {len(df)} rows")

# 3. Stack them vertically
master_df = pd.concat(dataframes, ignore_index=True)

# 4. CRITICAL: Sort strictly by the Unix timestamp to fix the timeline
master_df = master_df.sort_values(by='timestamp').reset_index(drop=True)

# 5. Save the repaired dataset
output_name = "repaired_jeepney_physics.csv"
master_df.to_csv(output_name, index=False)

print(f"\nSuccess! Rebuilt dataset saved as {output_name}")
print(f"Total continuous frames: {len(master_df)}")