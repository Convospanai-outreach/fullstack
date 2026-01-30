#!/bin/bash
# Export Script for GGUF Conversion (Raspberry Pi Target)

# Paths
MERGED_DIR="./training/models/merged-phi3"
OUTPUT_GGUF="./training/models/Phi-3-Custom.gguf"
LLAMA_CPP_DIR="../llama.cpp" # Assumption

echo "[Linkage] Checking for llama.cpp..."

if [ ! -d "$LLAMA_CPP_DIR" ]; then
    echo "⚠️ llama.cpp directory not found at $LLAMA_CPP_DIR"
    echo "Using Docker to convert (Requires docker installed)..."
    
    docker run --rm -v $(pwd):/app ghcr.io/ggerganov/llama.cpp:full \
        python3 /app/convert-hf-to-gguf.py /app/$MERGED_DIR \
        --outfile /app/$OUTPUT_GGUF \
        --outtype f16
else
    echo "Running local conversion..."
    python3 $LLAMA_CPP_DIR/convert-hf-to-gguf.py $MERGED_DIR \
        --outfile $OUTPUT_GGUF \
        --outtype f16
fi

echo "✅ Export Complete: $OUTPUT_GGUF"
