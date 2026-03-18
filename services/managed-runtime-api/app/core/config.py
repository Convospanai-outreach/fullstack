import os

SERVICE_NAME = os.getenv("SERVICE_NAME", "managed-runtime-api")
SERVICE_VERSION = os.getenv("SERVICE_VERSION", "1.0.0")
SIGNING_SECRET = os.getenv("SIGNING_SECRET", "")
DEFAULT_CAPABILITIES = {
    "tokenize": True,
    "classify": True,
    "generate": True,
    "execute": True
}
