"""
Train and export the AI-JEEP Random Forest model.

Dataset columns expected:
- earValue
- accelX
- accelY
- accelZ
- label
"""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split


def main() -> None:
    # Resolve paths relative to this script so it works regardless of cwd.
    edge_dir = Path(__file__).resolve().parent
    dataset_path = edge_dir / "dataset.csv"
    model_dir = edge_dir / "models"
    model_path = model_dir / "rf_model.pkl"

    # 1) Load CSV dataset with pandas.
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    df = pd.read_csv(dataset_path)

    # 2) Separate input features and target label.
    feature_cols = ["earValue", "accelX", "accelY", "accelZ"]
    target_col = "label"

    missing = [col for col in feature_cols + [target_col] if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns in dataset.csv: {missing}")

    X = df[feature_cols]
    y = df[target_col]

    # 3) Split into train/test sets (80/20) with reproducible randomness.
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y if y.nunique() > 1 else None,
    )

    # 4) Initialize and train Random Forest classifier.
    model = RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    # 5) Evaluate on test data and print metrics for documentation.
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, digits=4)

    print("\n=== AI-JEEP Model Evaluation ===")
    print(f"Accuracy Score: {accuracy:.4f}")
    print("\nClassification Report:")
    print(report)

    # 6) Ensure models directory exists, then export model as .pkl.
    model_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    print(f"Model saved to: {model_path}")


if __name__ == "__main__":
    main()
