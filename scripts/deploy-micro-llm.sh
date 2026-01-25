#!/bin/bash
# Phi-3-mini Deployment Script (Raspberry Pi)
# Run this script to set up the local Micro-LLM inference server

set -e

echo "=================================================="
echo "Phi-3-mini (MIT) - Deployment Script"
echo "=================================================="

# Configuration
MODEL_NAME="Phi-3-mini-4k-instruct-q4.gguf"
MODEL_URL="https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/${MODEL_NAME}"
LLAMA_DIR="./llama.cpp"
MODEL_DIR="./models"
PORT=8081

# Step 1: Check prerequisites
echo ""
echo "[1/5] Checking prerequisites..."
if ! command -v wget &> /dev/null && ! command -v curl &> /dev/null; then
    echo "❌ Error: wget or curl required for downloading"
    exit 1
fi

if ! command -v make &> /dev/null; then
    echo "❌ Error: make required for building llama.cpp"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Error: git required"
    exit 1
fi

echo "✅ Prerequisites OK"

# Step 2: Clone llama.cpp
echo ""
echo "[2/5] Setting up llama.cpp..."
if [ ! -d "$LLAMA_DIR" ]; then
    git clone https://github.com/ggerganov/llama.cpp "$LLAMA_DIR"
    cd "$LLAMA_DIR"
    make
    cd ..
    echo "✅ llama.cpp built successfully"
else
    echo "✅ llama.cpp already exists"
fi

# Step 3: Download model
echo ""
echo "[3/5] Downloading Mistral 7B model (Q4_K_M quantization)..."
mkdir -p "$MODEL_DIR"

if [ ! -f "$MODEL_DIR/$MODEL_NAME" ]; then
    if command -v wget &> /dev/null; then
        wget -O "$MODEL_DIR/$MODEL_NAME" "$MODEL_URL"
    else
        curl -L -o "$MODEL_DIR/$MODEL_NAME" "$MODEL_URL"
    fi
    echo "✅ Model downloaded successfully"
else
    echo "✅ Model already downloaded"
fi

# Step 4: Create systemd service (optional)
echo ""
echo "[4/5] Creating startup script..."
cat > start-micro-llm.sh << EOF
#!/bin/bash
cd \$(dirname \$0)
./llama.cpp/build/bin/server \\
  -m ./models/${MODEL_NAME} \\
  --port ${PORT} \\
  --n-gpu-layers 0 \\
  --ctx-size 512 \\
  --n-predict 128 \\
  --threads 4
EOF

chmod +x start-micro-llm.sh
echo "✅ Startup script created: ./start-micro-llm.sh"

# Step 5: Test server
echo ""
echo "[5/5] Testing server startup..."
echo "Starting server on port ${PORT}..."
echo "To start manually: ./start-micro-llm.sh"
echo ""
echo "=================================================="
echo "✅ Deployment Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Run: ./start-micro-llm.sh"
echo "2. Test: curl -X POST http://localhost:${PORT}/infer -d '{\"taskType\":\"TONE_NORMALIZATION\",\"inputText\":\"yo\"}'"
echo "3. Configure .env: MICRO_LLM_URL=http://localhost:${PORT}"
