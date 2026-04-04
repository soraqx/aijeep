from huggingface_hub import hf_hub_download 
import os

def get_model_path():
    repo_id = "soraqx/rfmodel"
    filename = "rf_model.pkl"

    print(f"checking if model {filename} exists locally...")

    model_path=hf_hub_download(repo_id=repo_id, filename=filename)

    print("model is ready to use!")
    return model_path