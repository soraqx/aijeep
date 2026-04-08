import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import time

print("--- AI-JEEP Model Training Pipeline ---")
start_time = time.time()

# 1. LOAD AND CLEAN DATA
print("\n[1/5] Loading raw dataset...")
df = pd.read_csv('raw_dataset.csv')

# Filter out GPS Cold Starts (we simulated 8 sats, but this protects the real run)
df = df[df['sats'] >= 4].copy()
df.reset_index(drop=True, inplace=True)
print(f"Data loaded successfully. Total usable frames: {len(df)}")

# 2. TEMPORAL FEATURE ENGINEERING
print("[2/5] Engineering temporal and normalized features...")
FPS = 15
WINDOW_1_SEC = 1 * FPS
WINDOW_3_SEC = 3 * FPS

# Calculate baseline EAR from the first 15 seconds (Assuming driver is awake)
baseline_frames = 15 * FPS
ear_baseline = df['earValue'].head(baseline_frames).mean()
print(f"Calculated Driver EAR Baseline: {ear_baseline:.4f}")

# Normalized EAR
df['N_EAR'] = df['earValue'] / ear_baseline

# Rolling Vision Features
df['N_EAR_rolling_min'] = df['N_EAR'].rolling(window=WINDOW_1_SEC).min()
df['N_EAR_rolling_var'] = df['N_EAR'].rolling(window=WINDOW_3_SEC).var()

# Kinematic Features (Vector Magnitude)
df['Accel_Mag'] = np.sqrt(df['accel_x']**2 + df['accel_y']**2 + df['accel_z']**2)

# Rolling Kinematic Features
df['Accel_rolling_max'] = df['Accel_Mag'].rolling(window=WINDOW_1_SEC).max()
df['Accel_rolling_std'] = df['Accel_Mag'].rolling(window=WINDOW_3_SEC).std()

# Drop rows with NaN values created by the rolling window calculations
df.dropna(inplace=True)
print(f"Feature engineering complete. Frames after dropping NaN windows: {len(df)}")

# 3. PREPARE FOR TRAINING
print("\n[3/5] Splitting data into training and testing sets...")
features = [
    'N_EAR', 
    'N_EAR_rolling_min', 
    'N_EAR_rolling_var', 
    'Accel_rolling_max', 
    'Accel_rolling_std', 
    'speed_kmh'
]

X = df[features]
y = df['Label']

# Using shuffle=False to prevent time-series data leakage during validation
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

print(f"Training on {len(X_train)} frames, Validating on {len(X_test)} frames.")

# 4. MODEL TRAINING
print("\n[4/5] Training the Edge-Optimized Random Forest...")
rf_model = RandomForestClassifier(
    n_estimators=100,         # 100 trees is plenty for Edge AI
    max_depth=10,             # Prevent overfitting to noise
    min_samples_leaf=5,       # Require consensus before classifying an anomaly
    class_weight='balanced',  # Heavily penalize missing Class 1 or 2
    random_state=42,
    n_jobs=-1                 # Use all CPU cores for faster training
)

rf_model.fit(X_train, y_train)

# 5. EVALUATION AND EXPORT
print("\n[5/5] Evaluating Model Performance...")
y_pred = rf_model.predict(X_test)

print("\n--- Classification Report ---")
# 0: Normal, 1: Drowsy, 2: Distracted/Harsh Braking
print(classification_report(y_test, y_pred, target_names=['Normal (0)', 'Drowsy (1)', 'Harsh Brake (2)']))

print("--- Confusion Matrix ---")
print(confusion_matrix(y_test, y_pred))

# Export the model
model_filename = 'ai_jeep_rf_model.pkl'
joblib.dump(rf_model, model_filename)

end_time = time.time()
print(f"\nPipeline complete! Model exported as '{model_filename}' in {end_time - start_time:.2f} seconds.")