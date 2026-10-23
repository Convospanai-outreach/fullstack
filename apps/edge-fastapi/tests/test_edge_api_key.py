import importlib
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException


def load_main(monkeypatch, **env):
    # main.py imports the SQLAlchemy models at module load; a stub keeps this
    # test free of a Postgres+pgvector database.
    database = types.ModuleType("database")
    for name in ("init_db", "get_db", "SessionLocal", "WorkflowRecord", "EdgeSetting", "EdgeActivityLog"):
        setattr(database, name, lambda: None)
    monkeypatch.setitem(sys.modules, "database", database)
    for name in ("EDGE_MODE", "EDGE_API_KEY", "EDGE_REQUIRE_API_KEY", "EDGE_EXECUTE_ENABLED"):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    sys.modules.pop("main", None)
    return importlib.import_module("main")


def test_no_key_configured_is_refused_even_with_edge_mode_off(monkeypatch):
    main = load_main(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        main.require_edge_api_key(x_api_key=None, authorization=None)
    assert exc.value.status_code == 503


def test_no_key_configured_is_allowed_only_when_explicitly_opted_out(monkeypatch):
    main = load_main(monkeypatch, EDGE_REQUIRE_API_KEY="false")
    main.require_edge_api_key(x_api_key=None, authorization=None)


def test_configured_key_is_checked(monkeypatch):
    main = load_main(monkeypatch, EDGE_API_KEY="k" * 32)
    with pytest.raises(HTTPException) as exc:
        main.require_edge_api_key(x_api_key="wrong", authorization=None)
    assert exc.value.status_code == 401
    main.require_edge_api_key(x_api_key="k" * 32, authorization=None)
    main.require_edge_api_key(x_api_key=None, authorization="Bearer " + "k" * 32)
