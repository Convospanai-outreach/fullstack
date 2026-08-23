import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncio

import httpx
import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from services.cloud_registration import (
    CloudRegistrationClient,
    build_client_from_env,
    get_or_create_keypair,
    sign_payload,
)


def make_session_factory():
    # cloud_registration.py filters with `EdgeSetting.key == key`; a real
    # SQLAlchemy session would resolve that expression against a Postgres+
    # pgvector database, which we don't want to require for this unit test.
    # Instead we monkeypatch _get_setting/_set_setting directly (see each
    # test below) and only use DictSession as an opaque session_factory arg.
    store = {}

    class DictSession:
        def query(self, _model):
            return self

        def filter(self, _expr):
            return self

        def first(self):
            return None

        def add(self, row):
            store[row.key] = row.value

        def commit(self):
            pass

        def close(self):
            pass

    return store, DictSession


def test_get_or_create_keypair_generates_and_persists(monkeypatch):
    store, DictSession = make_session_factory()

    def fake_get_setting(db, key):
        return store.get(key)

    def fake_set_setting(db, key, value):
        store[key] = value

    import services.cloud_registration as mod
    monkeypatch.setattr(mod, "_get_setting", fake_get_setting)
    monkeypatch.setattr(mod, "_set_setting", fake_set_setting)

    db = DictSession()
    private_pem_1, public_pem_1 = get_or_create_keypair(db)
    assert "BEGIN PRIVATE KEY" in private_pem_1
    assert "BEGIN PUBLIC KEY" in public_pem_1

    # Second call must return the same keys, not regenerate.
    private_pem_2, public_pem_2 = get_or_create_keypair(db)
    assert private_pem_1 == private_pem_2
    assert public_pem_1 == public_pem_2


def test_sign_payload_verifies_with_public_key(monkeypatch):
    store, DictSession = make_session_factory()

    def fake_get_setting(db, key):
        return store.get(key)

    def fake_set_setting(db, key, value):
        store[key] = value

    import services.cloud_registration as mod
    monkeypatch.setattr(mod, "_get_setting", fake_get_setting)
    monkeypatch.setattr(mod, "_set_setting", fake_set_setting)

    db = DictSession()
    private_pem, public_pem = get_or_create_keypair(db)

    timestamp = "1700000000000"
    nonce = "abc123"
    raw_body = '{"runtimeVersion":"1.0.0"}'
    signature_hex = sign_payload(private_pem, timestamp, nonce, raw_body)

    # Verify the way apps/api/src/lib/edgeRuntime.ts's verifyEdgeRequestSignature
    # does: SHA256 digest of "{timestamp}.{nonce}.{raw_body}", RSA PKCS1v15.
    public_key = serialization.load_pem_public_key(public_pem.encode("utf-8"))
    message = f"{timestamp}.{nonce}.{raw_body}".encode("utf-8")
    public_key.verify(bytes.fromhex(signature_hex), message, padding.PKCS1v15(), hashes.SHA256())


def test_build_client_from_env_returns_none_when_not_configured(monkeypatch):
    monkeypatch.delenv("EDGE_CLOUD_API_URL", raising=False)
    client = build_client_from_env(session_factory=None, hardware_fingerprint="fp-1")
    assert client is None


def test_build_client_from_env_returns_client_when_configured(monkeypatch):
    monkeypatch.setenv("EDGE_CLOUD_API_URL", "https://api.example.com")
    monkeypatch.setenv("EDGE_HEARTBEAT_INTERVAL_SECONDS", "5")
    client = build_client_from_env(session_factory=None, hardware_fingerprint="fp-1")
    assert client is not None
    assert client.cloud_api_url == "https://api.example.com"
    assert client.interval_seconds == 5
    assert client.hardware_fingerprint == "fp-1"


def test_send_heartbeat_once_sends_expected_headers(monkeypatch):
    store, DictSession = make_session_factory()

    def fake_get_setting(db, key):
        return store.get(key)

    def fake_set_setting(db, key, value):
        store[key] = value

    import services.cloud_registration as mod
    monkeypatch.setattr(mod, "_get_setting", fake_get_setting)
    monkeypatch.setattr(mod, "_set_setting", fake_set_setting)

    captured = {}

    class FakeResponse:
        status_code = 200
        text = "ok"

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def put(self, url, content=None, headers=None):
            captured["url"] = url
            captured["content"] = content
            captured["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    client = CloudRegistrationClient(
        session_factory=DictSession,
        cloud_api_url="https://api.example.com",
        hardware_fingerprint="fp-42",
        interval_seconds=20,
    )

    ok = asyncio.run(client.send_heartbeat_once())

    assert ok is True
    assert captured["url"] == "https://api.example.com/edge/nodes"
    assert captured["headers"]["x-edge-hardware-fingerprint"] == "fp-42"
    assert "x-edge-timestamp" in captured["headers"]
    assert "x-edge-nonce" in captured["headers"]
    assert "x-edge-signature" in captured["headers"]


def test_send_heartbeat_once_handles_not_paired(monkeypatch):
    store, DictSession = make_session_factory()

    def fake_get_setting(db, key):
        return store.get(key)

    def fake_set_setting(db, key, value):
        store[key] = value

    import services.cloud_registration as mod
    monkeypatch.setattr(mod, "_get_setting", fake_get_setting)
    monkeypatch.setattr(mod, "_set_setting", fake_set_setting)

    class FakeResponse:
        status_code = 404
        text = "not paired"

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def put(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    client = CloudRegistrationClient(
        session_factory=DictSession,
        cloud_api_url="https://api.example.com",
        hardware_fingerprint="fp-42",
        interval_seconds=20,
    )

    ok = asyncio.run(client.send_heartbeat_once())
    assert ok is False
