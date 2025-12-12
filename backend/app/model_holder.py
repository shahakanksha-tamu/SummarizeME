import threading
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from .config import settings

# Shared globals
_lock = threading.Lock()
_tok = None
_mdl = None
_device = None

# Choose device - CPU or GPU
def _get_device():
    if settings.DEVICE: 
        return torch.device(settings.DEVICE)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load and return the model and tokenizer from HuggingFace
def get_model():
    global _tok, _mdl, _device
    if _tok is not None and _mdl is not None:
        return _tok, _mdl, _device

    with _lock:  # ensure only one thread loads
        if _tok is not None and _mdl is not None:
            return _tok, _mdl, _device

        _device = _get_device()
        auth = {"token": settings.HF_TOKEN} if settings.HF_TOKEN else {}

        print(f"[ModelHolder] Loading model: {settings.MODEL_ID} on {_device}")

        _tok = AutoTokenizer.from_pretrained(settings.MODEL_ID, **auth)
        _mdl = AutoModelForSeq2SeqLM.from_pretrained(settings.MODEL_ID, **auth)
        _mdl = _mdl.to(_device)

        print("[ModelHolder] Model loaded successfully.")
        return _tok, _mdl, _device
