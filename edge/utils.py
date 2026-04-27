import os
from pathlib import Path

from huggingface_hub import hf_hub_download

DEFAULT_REPO_ID = os.environ.get("HF_MODEL_REPO", "soraqx/rfmodel")
DEFAULT_MODEL_FILENAME = os.environ.get("HF_MODEL_FILENAME", "ai_jeep_rf_model.pkl")


def get_model_path() -> str:
    env_path = os.environ.get("MODEL_PATH") or os.environ.get("LOCAL_MODEL_PATH")
    if env_path:
        local_path = Path(env_path)
        if not local_path.is_absolute():
            local_path = Path(__file__).resolve().parent / local_path

        if local_path.exists():
            print(f"Using local model path: {local_path}")
            return str(local_path)

        raise FileNotFoundError(
            f"MODEL_PATH/LOCAL_MODEL_PATH is set to {local_path} but the file does not exist."
        )

    repo_id = DEFAULT_REPO_ID
    filename = DEFAULT_MODEL_FILENAME

    print(f"Checking Hugging Face repo {repo_id} for {filename}...")
    model_path = hf_hub_download(repo_id=repo_id, filename=filename)
    print("Model is ready to use!")
    return model_path


def download_model_from_hub(repo_id: str, filename: str) -> str:
    return hf_hub_download(repo_id=repo_id, filename=filename)
