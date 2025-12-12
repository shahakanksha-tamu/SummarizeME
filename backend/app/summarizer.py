from typing import Literal
import re
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
from .model_holder import get_model

# Summary length configurations
LENGTH_CONFIG = {
    "short": {
        "min_new_tokens": 80,
        "max_new_tokens": 140,
        "length_penalty": 1.2,
        "num_beams": 3,
    },
    "medium": {
        "min_new_tokens": 140,
        "max_new_tokens": 260,
        "length_penalty": 1.0,
        "num_beams": 3,
    },
    "long": {
        "min_new_tokens": 220,
        "max_new_tokens": 380,
        "length_penalty": 0.9,
        "num_beams": 4,
    },
}

# Length Controller
MAX_INPUT_TOKENS = 1024

# Generate Chunks
def _split_into_chunks(text: str, max_chars: int = 2500) -> list[str]:
    print("[DEBUG] Splitting text into chunks")
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for sent in sentences:
        s = sent.strip()
        if not s:
            continue

        if current_len + len(s) + 1 > max_chars and current:
            chunk_text = " ".join(current)
            chunks.append(chunk_text)
            print(
                f"[DEBUG] Created chunk {len(chunks)} "
                f"(chars={len(chunk_text)})"
            )
            current = [s]
            current_len = len(s)
        else:
            current.append(s)
            current_len += len(s) + 1

    if current:
        chunk_text = " ".join(current)
        chunks.append(chunk_text)
        print(
            f"[DEBUG] Created chunk {len(chunks)} "
            f"(chars={len(chunk_text)})"
        )

    print(f"[DEBUG] Total chunks created: {len(chunks)}")
    return chunks


# Single-pass summarizer
def _summarize_single(text: str, level: str, tok, mdl, device) -> str:
    print(f"[DEBUG] Running SINGLE-PASS summarization, level={level}")
    cfg = LENGTH_CONFIG.get(level, LENGTH_CONFIG["medium"])

    prompt = (
        "Write a concise, coherent, and complete summary of the given text."
        "Be factuallly accurate.\n\n"
        "Text:\n" + text
    )

    enc = tok(
        prompt,
        return_tensors="pt",
        truncation=True,
        max_length=1024,
    ).to(device)

    out = mdl.generate(
        **enc,
        num_beams=int(cfg["num_beams"]),
        do_sample=False,
        no_repeat_ngram_size=2,
        length_penalty=float(cfg["length_penalty"]),
        max_new_tokens=int(cfg["max_new_tokens"]),
        min_new_tokens=int(cfg["min_new_tokens"]),
        renormalize_logits=True,
        early_stopping=True,
    )

    summary = tok.decode(out[0], skip_special_tokens=True).strip()
    print(
        f"[DEBUG] SINGLE-PASS summary length: "
        f"{len(summary)} chars, {len(summary.split())} words"
    )
    return summary


# Hierarchical summarization
def _summarize_hierarchical(text: str, level: str, tok, mdl, device) -> str:
    print("[DEBUG] Running HIERARCHICAL summarization")

    # Step 1: split
    chunks = _split_into_chunks(text)

    # Step 2: summarize each chunk
    partial_summaries: list[str] = []
    for i, chunk in enumerate(chunks):
        print(
            f"[DEBUG] Summarizing chunk {i+1}/{len(chunks)} "
            f"(chars={len(chunk)}, words={len(chunk.split())})"
        )
        part = _summarize_single(chunk, "medium", tok, mdl, device)
        partial_summaries.append(part)

    # Step 3: combine partial summaries
    combined = "\n\n".join(partial_summaries)
    print(
        "[DEBUG] Finished summarizing chunks. Combined summary length: "
        f"{len(combined)} chars, {len(combined.split())} words"
    )
    print("[DEBUG] Running final pass over combined summaries")

    # Step 4: final summary at requested level
    final = _summarize_single(combined, level, tok, mdl, device)
    print(
        "[DEBUG] Final hierarchical summary complete"
        f"Length: {len(final)} chars, {len(final.split())} words"
    )

    return final

 # Decide whether to use single-pass or hierarchical summarization
def summarize(text, level =  "medium"):
   
    tok, mdl, device = get_model()

    # Compute raw token length
    tokenized = tok(
        text,
        return_tensors="pt",
        truncation=False,
        add_special_tokens=False,
    )
    input_len = int(tokenized["input_ids"].shape[1])

    print("\n[DEBUG] ## Summarization Request ##")
    print(f"[DEBUG] Input length (tokens): {input_len}")
    print(f"[DEBUG] Requested level: {level}")

    # Decide mode
    if input_len <= MAX_INPUT_TOKENS:
        print("[DEBUG] Using SINGLE-PASS summarization.\n")
        result = _summarize_single(text, level, tok, mdl, device)

        return result

    print("[DEBUG] Using HIERARCHICAL summarization.\n")
    result = _summarize_hierarchical(text, level, tok, mdl, device)
   
    return result
