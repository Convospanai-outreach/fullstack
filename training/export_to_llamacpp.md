# Exporting Phi-3 Adapters to llama.cpp (GGUF)

This guide explains how to merge your LoRA adapters with the base Phi-3-mini model and convert it to GGUF format for efficient execution on Raspberry Pi.

## Prerequisites

1. **llama.cpp** installed and built.
2. **Python environment** with `torch`, `peft`, `transformers`, `gguf` installed.

## Step 1: Merge LoRA Adapters

Create a python script `merge_adapter.py`:

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

BASE_MODEL = "microsoft/Phi-3-mini-4k-instruct"
ADAPTER_DIR = "./adapters"
OUTPUT_DIR = "./models/merged-phi3"

print("Loading base model...")
base = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True
)

print("Loading LoRA adapter...")
model = PeftModel.from_pretrained(base, ADAPTER_DIR)

print("Merging weights...")
model = model.merge_and_unload()

print(f"Saving merged model to {OUTPUT_DIR}...")
model.save_pretrained(OUTPUT_DIR)
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
tokenizer.save_pretrained(OUTPUT_DIR)
print("Done!")
```

Run it:
```bash
python merge_adapter.py
```

## Step 2: Convert to GGUF (FP16)

Use the `convert-hf-to-gguf.py` script provided by llama.cpp.

```bash
python llama.cpp/convert-hf-to-gguf.py ./models/merged-phi3 \
  --outfile ./models/phi3-finetuned.gguf \
  --outtype f16
```

## Step 3: Quantize to Q4_K_M (Raspberry Pi Target)

Quantize the FP16 GGUF file to 4-bit to fit in 4GB RAM.

```bash
./llama.cpp/quantize ./models/phi3-finetuned.gguf ./models/phi3-finetuned-q4.gguf Q4_K_M
```

## Step 4: Verification

Check the file size. It should be approximately **2.3 GB**.

```bash
ls -lh ./models/phi3-finetuned-q4.gguf
```

## Step 5: Run on Raspberry Pi

Transfer `phi3-finetuned-q4.gguf` to your Pi and run with the server script:

```bash
./server \
  -m ./models/phi3-finetuned-q4.gguf \
  --port 8081 \
  --ctx-size 512 \
  --threads 4
```
