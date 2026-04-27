#!/usr/bin/env python3
"""Merge time-series vision and kinematic records for AI-JEEP training.

This script converts both raw timestamp series into elapsed seconds, stitches
vision EAR values to the nearest physical telemetry frame, and optionally applies
manual label zones.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

DEFAULT_PHYSICS_FILENAME = "jeepney_physics.csv"
DEFAULT_VISION_FILENAME = "human_vision.csv"
DEFAULT_OUTPUT_FILENAME = "dataset.csv"
DEFAULT_PHYSICS_TS = "timestamp"
DEFAULT_VISION_TS = "timestamp"
DEFAULT_EAR_COL = "earValue"
DEFAULT_MAX_TOLERANCE_SEC = 0.25

# ---------------------------------------------------------------------------
# Manual labeling section
# ---------------------------------------------------------------------------
# Add your own labeling zones here after you inspect the merged dataset.
# You can specify labels by raw merged row index or elapsed time in seconds.
# Label values: 0 = Normal, 1 = Drowsy, 2 = Harsh Braking.
LABEL_ZONES = [
    # Example:
    # {"start_idx": 100, "end_idx": 140, "label": 1},
    # {"start_sec": 500.0, "end_sec": 507.5, "label": 2},
]


def normalize_unix_timestamp(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    if numeric.isna().all():
        raise ValueError("Unable to parse any numeric timestamps from the provided column.")

    median = numeric.median(skipna=True)
    if median > 1e11:
        numeric = numeric / 1000.0
    return numeric.astype(float)


def detect_timestamp_column(df: pd.DataFrame, hint: Optional[str]) -> str:
    if hint and hint in df.columns:
        return hint

    candidates = [
        "timestamp",
        "time",
        "unix_timestamp",
        "ts",
        "time_sec",
        "time_s",
        "unix_time",
    ]
    for name in candidates:
        if name in df.columns:
            return name

    raise ValueError(
        "No timestamp column detected. Provide one explicitly with --physics-timestamp-col "
        "or --vision-timestamp-col."
    )


def load_dataframe(path: Path, timestamp_col: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    if timestamp_col not in df.columns:
        raise ValueError(f"Source file {path} does not contain timestamp column '{timestamp_col}'.")

    df = df.copy()
    df[timestamp_col] = normalize_unix_timestamp(df[timestamp_col])
    df["elapsed_seconds"] = df[timestamp_col] - float(df[timestamp_col].iloc[0])
    df.sort_values(timestamp_col, inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def apply_label_zones(df: pd.DataFrame) -> pd.DataFrame:
    if "Label" not in df.columns:
        df["Label"] = 0
    else:
        df["Label"] = df["Label"].fillna(0).astype(int)

    for zone in LABEL_ZONES:
        label = int(zone.get("label", 0))
        if label not in (0, 1, 2):
            raise ValueError(f"Label zone label must be 0, 1, or 2, got {label}.")

        if "start_idx" in zone and "end_idx" in zone:
            start_idx = int(zone["start_idx"])
            end_idx = int(zone["end_idx"])
            df.loc[start_idx:end_idx, "Label"] = label
        elif "start_sec" in zone and "end_sec" in zone:
            start_sec = float(zone["start_sec"])
            end_sec = float(zone["end_sec"])
            df.loc[(df["elapsed_seconds"] >= start_sec) & (df["elapsed_seconds"] <= end_sec), "Label"] = label
        else:
            raise ValueError(
                "Label zone must include either start_idx/end_idx or start_sec/end_sec."
            )

    return df


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fuse raw kinematic and vision CSV streams into a synchronized dataset for AI-JEEP."
    )
    parser.add_argument(
        "--physics",
        default=DEFAULT_PHYSICS_FILENAME,
        help="Path to the jeepney physics CSV file.",
    )
    parser.add_argument(
        "--vision",
        default=DEFAULT_VISION_FILENAME,
        help="Path to the human vision CSV file.",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT_FILENAME,
        help="Path to the merged output CSV file.",
    )
    parser.add_argument(
        "--physics-timestamp-col",
        default=DEFAULT_PHYSICS_TS,
        help="Timestamp column name in the physics CSV.",
    )
    parser.add_argument(
        "--vision-timestamp-col",
        default=DEFAULT_VISION_TS,
        help="Timestamp column name in the vision CSV.",
    )
    parser.add_argument(
        "--ear-col",
        default=DEFAULT_EAR_COL,
        help="EAR column name in the vision CSV.",
    )
    parser.add_argument(
        "--max-tolerance-sec",
        type=float,
        default=DEFAULT_MAX_TOLERANCE_SEC,
        help="Maximum allowable elapsed second difference for merge_asof.",
    )

    args = parser.parse_args()

    physics_path = Path(args.physics)
    vision_path = Path(args.vision)
    output_path = Path(args.output)

    if not physics_path.exists():
        raise FileNotFoundError(f"Physics file not found: {physics_path}")
    if not vision_path.exists():
        raise FileNotFoundError(f"Vision file not found: {vision_path}")

    physics_df = load_dataframe(physics_path, detect_timestamp_column(pd.read_csv(physics_path, nrows=1), args.physics_timestamp_col))
    vision_df = load_dataframe(vision_path, detect_timestamp_column(pd.read_csv(vision_path, nrows=1), args.vision_timestamp_col))

    if args.ear_col not in vision_df.columns:
        raise ValueError(f"Vision file does not contain EAR column '{args.ear_col}'.")

    vision_df = vision_df[["elapsed_seconds", args.ear_col]].rename(columns={args.ear_col: "earValue"})
    merged = pd.merge_asof(
        physics_df,
        vision_df,
        on="elapsed_seconds",
        direction="nearest",
        tolerance=args.max_tolerance_sec,
    )

    if merged["earValue"].isna().any():
        missing = int(merged["earValue"].isna().sum())
        print(f"[Warning] {missing} rows have no nearest EAR value within tolerance {args.max_tolerance_sec}s.")

    merged = apply_label_zones(merged)
    merged.to_csv(output_path, index=False)

    print(f"Merged dataset saved to {output_path}")
    print(f"Total rows: {len(merged)}")
    print("Label distribution:\n", merged["Label"].value_counts())


if __name__ == "__main__":
    main()
