# ConvoSpan Edge FastAPI App

Standalone edge runtime extracted from `services/edge-node`.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Build Docker image

```bash
docker build -t convospan-edge-fastapi:split .
```

## Default port

- `8000`
