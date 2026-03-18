import hmac
import hashlib
import time
from fastapi import Header, HTTPException

from .config import SIGNING_SECRET

def verify_signature(
    x_signature: str | None = Header(default=None),
    x_timestamp: str | None = Header(default=None),
    x_nonce: str | None = Header(default=None),
    body: bytes | None = None
):
    if not SIGNING_SECRET:
        return
    if not x_signature or not x_timestamp or not x_nonce:
        raise HTTPException(status_code=401, detail="Missing signature headers")
    try:
        ts = int(x_timestamp)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid timestamp")
    now = int(time.time())
    if abs(now - ts) > 300:
        raise HTTPException(status_code=401, detail="Signature expired")
    msg = f"{x_timestamp}.{x_nonce}.".encode() + (body or b"")
    digest = hmac.new(SIGNING_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(digest, x_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
