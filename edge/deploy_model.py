#!/usr/bin/env python3
"""Upload a trained AI-JEEP model artifact to Hugging Face."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from huggingface_hub import HfApi


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload a trained model file to Hugging Face.")
    parser.add_argument(
        "--model-path",
        default="ai_jeep_rf_model.pkl",
        help="Path to the trained model file to upload.",
    )
    parser.add_argument(
        "--repo-id",
        default=os.environ.get("HF_MODEL_REPO", "soraqx/rfmodel"),
        help="Hugging Face repository ID to upload into.",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("HUGGINGFACE_TOKEN"),
        help="Hugging Face access token. If not provided, the environment variable HUGGINGFACE_TOKEN is used.",
    )
    args = parser.parse_args()

    model_path = Path(args.model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    if not args.token:
        raise ValueError("Hugging Face token is required via --token or HUGGINGFACE_TOKEN.")

    api = HfApi()
    print(f"Uploading {model_path.name} to {args.repo_id}...")
    api.upload_file(
        path_or_fileobj=str(model_path),
        path_in_repo=model_path.name,
        repo_id=args.repo_id,
        token=args.token,
        repo_type="model",
    )
    print("Upload complete.")


if __name__ == "__main__":
    main()
