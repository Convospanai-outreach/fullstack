# CraftMyFunnel Edge FastAPI App

Standalone edge runtime extracted from `services/edge-node`.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
uvicorn main:app --host 0.0.0.0 --port 8000
```

For `EDGE_MODE=enabled`, set `EDGE_API_KEY` and `EDGE_VAULT_KEY`. Sensitive routes accept either
`X-API-Key: <key>` or `Authorization: Bearer <key>`.

## Build Docker image

```bash
docker build -t craftmyfunnel-edge-fastapi:split .
```

## Raspberry Pi 5 build

Use the Pi profile for ARM64 edge mode. It keeps the image lighter by installing PII masking and
`llama-cpp-python` for GGUF micro LLM inference, while leaving the heavier sentence-transformer critic
as an optional server-class feature.

```bash
docker buildx build \
  --platform linux/arm64 \
  --build-arg REQUIREMENTS_FILE=requirements.pi.txt \
  --build-arg FORCE_CMAKE=1 \
  --build-arg CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_OPENMP=ON" \
  -t craftmyfunnel-edge-fastapi:pi5 .
```

Recommended Pi 5 env:

```bash
EDGE_MODE=enabled
EDGE_PRELOAD_MODELS=none
EDGE_SPACY_MODEL=en_core_web_sm
LLM_THREADS=4
LLM_CONTEXT_TOKENS=1536
LLM_BATCH_SIZE=128
DB_POOL_SIZE=2
DB_MAX_OVERFLOW=2
```

## Default port

- `8000`
