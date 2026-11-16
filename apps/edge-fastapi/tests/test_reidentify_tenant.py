import importlib
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

KEY = "k" * 32
EMAIL = "alice@example.com"


class FakeAnalyzer:
    """Stands in for presidio so the test needs no NLP models."""

    def analyze(self, text, language, entities):
        start = text.find(EMAIL)
        if start < 0:
            return []
        return [types.SimpleNamespace(entity_type="EMAIL_ADDRESS", start=start, end=start + len(EMAIL), score=0.99)]


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'edge.db'}")
    monkeypatch.setenv("EDGE_MODE", "true")
    monkeypatch.setenv("EDGE_API_KEY", KEY)
    monkeypatch.setenv("EDGE_VAULT_KEY", Fernet.generate_key().decode())
    for name in ("database", "main", "services.local_intelligence"):
        monkeypatch.delitem(sys.modules, name, raising=False)
    presidio = types.ModuleType("presidio_analyzer")
    presidio.AnalyzerEngine = FakeAnalyzer
    monkeypatch.setitem(sys.modules, "presidio_analyzer", presidio)

    database = importlib.import_module("database")
    database.init_db()
    main = importlib.import_module("main")
    main.local_intelligence.analyzer = FakeAnalyzer()
    main.local_intelligence._analyzer_loaded = True
    return TestClient(main.app)


H = {"x-api-key": KEY}


def sanitize(client, tenant="team-a", session="s1"):
    r = client.post("/v1/sanitize", headers=H, json={"text": f"mail {EMAIL}", "tenant_id": tenant, "session_id": session})
    assert r.status_code == 200, r.text
    return f"{session}_EMAIL_ADDRESS_1"


def reidentify(client, token, tenant, session=None, headers=H):
    body = {"token": token, "tenant_id": tenant}
    if session:
        body["session_id"] = session
    return client.post("/v1/reidentify", headers=headers, json=body)


def test_reidentify_requires_the_api_key(client):
    token = sanitize(client)
    assert reidentify(client, token, "team-a", headers={}).status_code == 401
    assert reidentify(client, token, "team-a", headers={"x-api-key": "wrong"}).status_code == 401


def test_owner_tenant_gets_the_original_back(client):
    token = sanitize(client)
    r = reidentify(client, token, "team-a")
    assert r.status_code == 200
    assert r.json() == {"original": EMAIL}


def test_another_tenant_cannot_read_it_even_knowing_token_and_session(client):
    token = sanitize(client, tenant="team-a")
    assert reidentify(client, token, "team-b").status_code == 404
    assert reidentify(client, token, "team-b", session="s1").status_code == 404


def test_tenant_is_required_on_both_calls(client):
    assert client.post("/v1/sanitize", headers=H, json={"text": f"mail {EMAIL}"}).status_code == 422
    assert client.post("/v1/reidentify", headers=H, json={"token": "x"}).status_code == 422
    assert client.post("/v1/reidentify", headers=H, json={"token": "x", "tenant_id": ""}).status_code == 422


def test_rows_from_before_tenant_binding_cannot_be_read(client):
    token = sanitize(client)
    import database

    with database.engine.begin() as conn:
        conn.exec_driver_sql("UPDATE pii_token_map SET tenant_id = NULL")
    assert reidentify(client, token, "team-a").status_code == 404


def test_init_db_adds_the_column_to_an_existing_table(monkeypatch, tmp_path):
    db = tmp_path / "old.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db}")
    monkeypatch.delitem(sys.modules, "database", raising=False)
    import sqlite3

    con = sqlite3.connect(db)
    con.execute("CREATE TABLE pii_token_map (token_id VARCHAR PRIMARY KEY, original_text TEXT, token_type VARCHAR, session_id VARCHAR, created_at DATETIME)")
    con.commit()
    con.close()
    database = importlib.import_module("database")
    database.init_db()
    database.init_db()  # idempotent
    cols = [r[1] for r in sqlite3.connect(db).execute("PRAGMA table_info(pii_token_map)")]
    assert "tenant_id" in cols
