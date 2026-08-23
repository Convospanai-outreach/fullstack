"""Optional heartbeat client: tells the cloud "this node is alive" so the
dashboard's connection status (HardwareService, /dashboard/settings/compliance)
reflects reality instead of a hardcoded single-node URL.

Entirely opt-in. If EDGE_CLOUD_API_URL isn't set, nothing in this module runs -
teams who never buy/pair a Sovereign Wall device are unaffected. Pairing itself
(giving the cloud this node's public key) happens once, out-of-band, via an
admin pasting the fingerprint + public key logged at startup into the dashboard
(POST /edge/nodes) - this module only sends the recurring heartbeat afterward.

Signing scheme mirrors apps/api/src/lib/edgeRuntime.ts's verifyEdgeRequestSignature:
RSA-SHA256 over f"{timestamp}.{nonce}.{raw_body}", where raw_body is the exact
JSON string sent as the heartbeat body.
"""

import asyncio
import logging
import os
import secrets
import time
from typing import Optional

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from sqlalchemy.orm import Session

from database import EdgeSetting

logger = logging.getLogger(__name__)

PRIVATE_KEY_SETTING = "node_private_key_pem"
PUBLIC_KEY_SETTING = "node_public_key_pem"


def _get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(EdgeSetting).filter(EdgeSetting.key == key).first()
    return row.value if row else None


def _set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(EdgeSetting).filter(EdgeSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(EdgeSetting(key=key, value=value))
    db.commit()


def get_or_create_keypair(db: Session) -> tuple[str, str]:
    """Returns (private_key_pem, public_key_pem), generating and persisting a
    new RSA keypair on first call. Stored locally (this node's own Postgres) -
    the private key never leaves the device."""
    private_pem = _get_setting(db, PRIVATE_KEY_SETTING)
    public_pem = _get_setting(db, PUBLIC_KEY_SETTING)
    if private_pem and public_pem:
        return private_pem, public_pem

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    _set_setting(db, PRIVATE_KEY_SETTING, private_pem)
    _set_setting(db, PUBLIC_KEY_SETTING, public_pem)
    logger.info("Generated a new node keypair (first boot, or keys were missing).")
    return private_pem, public_pem


def sign_payload(private_key_pem: str, timestamp: str, nonce: str, raw_body: str) -> str:
    key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
    message = f"{timestamp}.{nonce}.{raw_body}".encode("utf-8")
    signature = key.sign(message, padding.PKCS1v15(), hashes.SHA256())
    return signature.hex()


class CloudRegistrationClient:
    """Signs and sends periodic heartbeats to the cloud's /edge/nodes endpoint.
    Fully optional - construct and call start() only when EDGE_CLOUD_API_URL is
    configured; this class does nothing on its own otherwise."""

    def __init__(
        self,
        session_factory,
        cloud_api_url: str,
        hardware_fingerprint: str,
        interval_seconds: int = 20,
        runtime_version: Optional[str] = None,
        build_hash: Optional[str] = None,
    ):
        self.session_factory = session_factory
        self.cloud_api_url = cloud_api_url.rstrip("/")
        self.hardware_fingerprint = hardware_fingerprint
        self.interval_seconds = interval_seconds
        self.runtime_version = runtime_version
        self.build_hash = build_hash
        self._task: Optional[asyncio.Task] = None
        self._stopped = False

    def public_key_pem(self) -> str:
        db = self.session_factory()
        try:
            _, public_pem = get_or_create_keypair(db)
            return public_pem
        finally:
            db.close()

    async def send_heartbeat_once(self, vault_unlocked: bool = False) -> bool:
        db = self.session_factory()
        try:
            private_pem, _ = get_or_create_keypair(db)
        finally:
            db.close()

        import json

        body = {
            "runtimeVersion": self.runtime_version,
            "buildHash": self.build_hash,
            "vaultUnlocked": vault_unlocked,
        }
        raw_body = json.dumps(body)
        timestamp = str(int(time.time() * 1000))
        nonce = secrets.token_hex(16)
        signature = sign_payload(private_pem, timestamp, nonce, raw_body)

        headers = {
            "Content-Type": "application/json",
            "x-edge-hardware-fingerprint": self.hardware_fingerprint,
            "x-edge-timestamp": timestamp,
            "x-edge-nonce": nonce,
            "x-edge-signature": signature,
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.put(f"{self.cloud_api_url}/edge/nodes", content=raw_body, headers=headers)
        except httpx.RequestError as exc:
            logger.warning(f"Heartbeat request failed (network): {exc}")
            return False

        if response.status_code == 404:
            logger.info(
                "Not yet paired with the cloud. Pair this node from the dashboard using "
                f"fingerprint={self.hardware_fingerprint} publicKey=<see startup log>."
            )
            return False
        if response.status_code == 403:
            logger.warning(f"Heartbeat rejected (revoked or attestation failed): {response.text}")
            return False
        if response.status_code >= 400:
            logger.warning(f"Heartbeat failed: {response.status_code} {response.text}")
            return False

        logger.debug("Heartbeat sent successfully.")
        return True

    async def _loop(self):
        while not self._stopped:
            try:
                await self.send_heartbeat_once()
            except Exception as exc:  # noqa: BLE001 - heartbeat must never crash the node
                logger.warning(f"Heartbeat loop iteration errored: {exc}")
            await asyncio.sleep(self.interval_seconds)

    def start(self):
        if self._task is not None:
            return
        self._task = asyncio.create_task(self._loop())
        logger.info(
            f"Cloud heartbeat started (every {self.interval_seconds}s) -> {self.cloud_api_url}/edge/nodes"
        )

    def stop(self):
        self._stopped = True
        if self._task is not None:
            self._task.cancel()
            self._task = None


def build_client_from_env(session_factory, hardware_fingerprint: str) -> Optional[CloudRegistrationClient]:
    """Optional service: returns None (and logs nothing) unless the operator
    has explicitly opted this node into cloud connectivity by setting
    EDGE_CLOUD_API_URL. Onboarding activates this per-team by pairing (which
    requires this env var to be set on the physical device in the first
    place) - teams that don't buy the Sovereign Wall add-on never reach here."""
    cloud_api_url = os.getenv("EDGE_CLOUD_API_URL", "").strip()
    if not cloud_api_url:
        return None

    interval_seconds = int(os.getenv("EDGE_HEARTBEAT_INTERVAL_SECONDS", "20"))
    return CloudRegistrationClient(
        session_factory=session_factory,
        cloud_api_url=cloud_api_url,
        hardware_fingerprint=hardware_fingerprint,
        interval_seconds=interval_seconds,
        runtime_version=os.getenv("APP_VERSION", "1.0.0"),
        build_hash=os.getenv("EDGE_BUILD_HASH"),
    )
