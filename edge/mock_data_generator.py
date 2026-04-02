"""
Generate a synthetic edge-sensor dataset for AI-JEEP.

Creates 3,000 rows total:
- Label 0 (Normal): 1,000 rows
- Label 1 (Drowsy): 1,000 rows
- Label 2 (Distracted/Harsh Braking): 1,000 rows
"""

import random

import numpy as np
import pandas as pd


def generate_normal(n_rows: int) -> pd.DataFrame:
    """Generate normal-driving samples (label 0)."""
    return pd.DataFrame(
        {
            "earValue": np.random.uniform(0.25, 0.35, n_rows),
            "accelX": np.random.normal(0.0, 0.1, n_rows),
            "accelY": np.random.normal(0.0, 0.1, n_rows),
            "accelZ": np.random.normal(0.0, 0.1, n_rows),
            "label": 0,
        }
    )


def generate_drowsy(n_rows: int) -> pd.DataFrame:
    """Generate drowsy-driving samples (label 1)."""
    return pd.DataFrame(
        {
            "earValue": np.random.uniform(0.15, 0.22, n_rows),
            "accelX": np.random.normal(0.0, 0.1, n_rows),
            "accelY": np.random.normal(0.0, 0.1, n_rows),
            "accelZ": np.random.normal(0.0, 0.1, n_rows),
            "label": 1,
        }
    )


def generate_harsh_events(n_rows: int) -> pd.DataFrame:
    """Generate distracted/harsh-braking samples (label 2)."""
    # Base vibration similar to normal driving.
    accel_x = np.random.normal(0.0, 0.15, n_rows)
    accel_z = np.random.normal(0.0, 0.15, n_rows)

    # Force accelY spikes in either positive or negative direction.
    accel_y = []
    for _ in range(n_rows):
        sign = random.choice([-1, 1])
        magnitude = random.uniform(1.5, 3.0)
        accel_y.append(sign * magnitude)

    return pd.DataFrame(
        {
            "earValue": np.random.uniform(0.25, 0.35, n_rows),
            "accelX": accel_x,
            "accelY": np.array(accel_y),
            "accelZ": accel_z,
            "label": 2,
        }
    )


def main() -> None:
    rows_per_label = 1000

    normal_df = generate_normal(rows_per_label)
    drowsy_df = generate_drowsy(rows_per_label)
    harsh_df = generate_harsh_events(rows_per_label)

    # Combine and shuffle so labels are mixed.
    dataset_df = pd.concat([normal_df, drowsy_df, harsh_df], ignore_index=True)
    dataset_df = dataset_df.sample(frac=1.0, random_state=42).reset_index(drop=True)

    output_path = "edge/dataset.csv"
    dataset_df.to_csv(output_path, index=False)

    print(f"Created synthetic dataset at: {output_path}")
    print("Label distribution:")
    print(dataset_df["label"].value_counts().sort_index())


if __name__ == "__main__":
    main()
