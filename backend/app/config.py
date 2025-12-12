import os

class Settings:

    # Model ID for the HuggingFace
    MODEL_ID: str = os.getenv("MODEL_ID", "akankshashah/flan-t5-base-samsum-merged")

    DEVICE: str = os.getenv("DEVICE", "")

    # HuggingFace token to access the model
    HF_TOKEN: str | None = os.getenv("HF_TOKEN", "HF_TOKEN_PLACEHOLDER")

    CORS_ALLOW_ORIGINS: list[str] = [
        "*" # Allow all origins for CORS for local development
    ]

settings = Settings()
