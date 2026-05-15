import argparse
from pathlib import Path
import time
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

# --- KINEMATIC HARDWARE DEFAULTS ---
DEFAULT_INPUT_FILE = "labeled_kinematic_data.csv"
DEFAULT_OUTPUT_FILE = "kinematic_rfc.pkl"
DEFAULT_FPS = 5  # GPS/MPU bottleneck rate
DEFAULT_TEST_SIZE = 0.2
DEFAULT_RANDOM_STATE = 42

import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def plot_model_results(model, X_test, y_test, y_pred, class_names, title_prefix="Model"):
    """Generates and saves a Confusion Matrix and Feature Importance chart."""
    print("\nGenerating visual charts...")
    
    # --- 1. Confusion Matrix Heatmap ---
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=class_names, yticklabels=class_names)
    plt.title(f"{title_prefix} - Confusion Matrix")
    plt.ylabel('Actual Truth')
    plt.xlabel('AI Prediction')
    plt.tight_layout()
    cm_filename = f"{title_prefix.lower()}_confusion_matrix.png"
    plt.savefig(cm_filename)
    plt.close()
    print(f" -> Saved: {cm_filename}")

    # --- 2. Feature Importance Bar Chart ---
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    features = X_test.columns

    plt.figure(figsize=(10, 6))
    plt.title(f"{title_prefix} - Feature Importances")
    # Plot the bars
    plt.bar(range(X_test.shape[1]), importances[indices], align="center", color='teal')
    # Add the feature names to the x-axis
    plt.xticks(range(X_test.shape[1]), [features[i] for i in indices], rotation=15)
    plt.tight_layout()
    fi_filename = f"{title_prefix.lower()}_feature_importance.png"
    plt.savefig(fi_filename)
    plt.close()
    print(f" -> Saved: {fi_filename}")


def build_kinematic_features(df: pd.DataFrame, fps: int) -> pd.DataFrame:
    df = df.copy()
    
    # Calculate rolling features over a 3-second window (15 frames at 5 FPS)
    window_size = 3 * fps 
    
    # Assuming accel_y is your primary braking axis based on earlier scripts
    df["Accel_rolling_max"] = df["accel_y"].rolling(window=window_size).max()
    df["Accel_rolling_std"] = df["accel_y"].rolling(window=window_size).std()
    
    # Drop the NaN values created by the rolling windows
    df = df.dropna().reset_index(drop=True)
    return df

def main() -> None:
    print("--- AI-JEEP: Kinematic Model Trainer ---")
    start_time = time.time()

    input_path = Path(DEFAULT_INPUT_FILE)
    output_path = Path(DEFAULT_OUTPUT_FILE)

    if not input_path.exists():
        print(f"Error: {input_path} not found.")
        return

    df = pd.read_csv(input_path)
    print(f"Loaded {len(df)} rows from {input_path.name}")

    # 1. Feature Extraction
    df_features = build_kinematic_features(df, DEFAULT_FPS)

    # 2. Isolate Features and Labels
    # We strictly use the extracted physics and speed, completely ignoring EAR
    features = ["Accel_rolling_max", "Accel_rolling_std", "speed_kmh"]
    X = df_features[features]
    y = df_features["Label"]

    # Ensure we are only training on 0s and 2s
    valid_classes = y.isin([0, 2])
    X = X[valid_classes]
    y = y[valid_classes]

    print(f"Training on {len(X)} usable frames...")
    print(f"Class Distribution:\n{y.value_counts()}")

    # 3. Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=DEFAULT_TEST_SIZE, random_state=DEFAULT_RANDOM_STATE, stratify=y
    )

    # 4. Model Training
    rf_model = RandomForestClassifier(n_estimators=100, random_state=DEFAULT_RANDOM_STATE, n_jobs=-1)
    rf_model.fit(X_train, y_train)

    # 5. Evaluation
    y_pred = rf_model.predict(X_test)
    print("\n--- Classification Report ---")
    print(classification_report(y_test, y_pred, target_names=["Normal (0)", "Harsh Brake (2)"]))
    
    print("--- Confusion Matrix ---")
    print(confusion_matrix(y_test, y_pred))
    plot_model_results(rf_model, X_test, y_test, y_pred, ["Normal", "Harsh Brake"], "Kinematic")
    # 6. Export
    joblib.dump(rf_model, output_path)
    print(f"\nPipeline complete! Exported as '{output_path}' in {time.time() - start_time:.2f} seconds.")

if __name__ == "__main__":
    main()