import argparse
from pathlib import Path
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split


DEFAULT_INPUT_FILE = "raw_dataset.csv"
DEFAULT_OUTPUT_FILE = "ai_jeep_rf_model.pkl"
DEFAULT_FPS = 15
DEFAULT_BASELINE_SEC = 15
DEFAULT_TEST_SIZE = 0.2
DEFAULT_RANDOM_STATE = 42


def build_features(df: pd.DataFrame, fps: int) -> pd.DataFrame:
    baseline_frames = int(DEFAULT_BASELINE_SEC * fps)
    if len(df) < baseline_frames:
        raise ValueError(
            f"Input data must contain at least {baseline_frames} rows for baseline EAR calculation."
        )

    ear_baseline = df["earValue"].head(baseline_frames).mean()
    if ear_baseline <= 0 or not np.isfinite(ear_baseline):
        raise ValueError("Calculated EAR baseline is invalid.")

    df = df.copy()
    df["N_EAR"] = df["earValue"] / ear_baseline
    df["N_EAR_rolling_min"] = df["N_EAR"].rolling(window=1 * fps).min()
    df["N_EAR_rolling_var"] = df["N_EAR"].rolling(window=3 * fps).var()

    df["Accel_Mag"] = np.sqrt(
        df["accel_x"] ** 2 + df["accel_y"] ** 2 + df["accel_z"] ** 2
    )
    df["Accel_rolling_max"] = df["Accel_Mag"].rolling(window=1 * fps).max()
    df["Accel_rolling_std"] = df["Accel_Mag"].rolling(window=3 * fps).std()

    df = df.dropna().reset_index(drop=True)
    return df


def train_model(input_path: Path, output_path: Path, test_size: float, random_state: int) -> None:
    print("--- AI-JEEP Model Training Pipeline ---")
    start_time = time.time()

    print(f"[1/5] Loading raw dataset from {input_path}...")
    df = pd.read_csv(input_path)

    required_columns = [
        "earValue",
        "accel_x",
        "accel_y",
        "accel_z",
        "speed_kmh",
        "Label",
    ]
    missing = [c for c in required_columns if c not in df.columns]
    if missing:
        raise ValueError(f"Input file is missing required columns: {', '.join(missing)}")

    if "sats" in df.columns:
        df = df[df["sats"] >= 4].copy()
    else:
        df = df.copy()
    df.reset_index(drop=True, inplace=True)
    print(f"Data loaded successfully. Total usable frames: {len(df)}")

    print("[2/5] Engineering temporal and normalized features...")
    df = build_features(df, DEFAULT_FPS)
    print(f"Feature engineering complete. Frames after dropping NaN windows: {len(df)}")

    print("[3/5] Splitting data into training and testing sets...")
    features = [
        "N_EAR",
        "N_EAR_rolling_min",
        "N_EAR_rolling_var",
        "Accel_rolling_max",
        "Accel_rolling_std",
        "speed_kmh",
    ]
    X = df[features]
    y = df["Label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, shuffle=False
    )
    print(f"Training on {len(X_train)} frames, Validating on {len(X_test)} frames.")

    print("[4/5] Training the Edge-Optimized Random Forest...")
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=random_state,
        n_jobs=-1,
    )
    rf_model.fit(X_train, y_train)

    print("[5/5] Evaluating model performance...")
    y_pred = rf_model.predict(X_test)
    print("\n--- Classification Report ---")
    print(
        classification_report(
            y_test,
            y_pred,
            target_names=["Normal (0)", "Drowsy (1)", "Harsh Brake (2)"],
        )
    )
    print("--- Confusion Matrix ---")
    print(confusion_matrix(y_test, y_pred))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(rf_model, output_path)
    print(
        f"\nPipeline complete! Model exported as '{output_path}' in {time.time() - start_time:.2f} seconds."
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train the AI-JEEP RandomForest model from a fused dataset."
    )
    parser.add_argument(
        "--input",
        default=DEFAULT_INPUT_FILE,
        help="Path to input CSV dataset.",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT_FILE,
        help="Path to export the trained model pickle file.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=DEFAULT_TEST_SIZE,
        help="Fraction of data held out for validation.",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=DEFAULT_RANDOM_STATE,
        help="Random state for training reproducibility.",
    )
    args = parser.parse_args()

    train_model(
        input_path=Path(args.input),
        output_path=Path(args.output),
        test_size=args.test_size,
        random_state=args.random_state,
    )


if __name__ == "__main__":
    main()
