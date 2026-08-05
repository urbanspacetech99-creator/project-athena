from fastapi.testclient import TestClient

from athena.api.app import create_app
from athena.config import Settings


def _settings(**kw) -> Settings:
    return Settings(db_auto_create=False, **kw)


def test_serves_dashboard_when_dist_exists(tmp_path):
    (tmp_path / "index.html").write_text("<!doctype html><title>UrbanSpace</title>", encoding="utf-8")
    app = create_app(_settings(frontend_dist=str(tmp_path)))
    client = TestClient(app)
    res = client.get("/")
    assert res.status_code == 200
    assert "UrbanSpace" in res.text


def test_api_routes_take_priority_over_static(tmp_path):
    (tmp_path / "index.html").write_text("<html></html>", encoding="utf-8")
    app = create_app(_settings(frontend_dist=str(tmp_path)))
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok"}


def test_no_mount_when_dist_missing(tmp_path):
    app = create_app(_settings(frontend_dist=str(tmp_path / "nope")))
    client = TestClient(app)
    assert client.get("/").status_code == 404
    assert client.get("/health").status_code == 200


def test_empty_frontend_dist_never_mounts():
    # Regression: Path("") is the CWD and is_dir() is True — an empty setting must
    # not mount the entire working directory (e.g. the repo root) at "/".
    app = create_app(_settings(frontend_dist=""))
    client = TestClient(app)
    assert client.get("/").status_code == 404
    # A file that exists in the repo-root CWD must not be reachable.
    assert client.get("/pyproject.toml").status_code == 404
    assert client.get("/health").status_code == 200


def test_serves_nested_assets(tmp_path):
    (tmp_path / "index.html").write_text("<html></html>", encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log(1)", encoding="utf-8")
    app = create_app(_settings(frontend_dist=str(tmp_path)))
    client = TestClient(app)
    res = client.get("/assets/app.js")
    assert res.status_code == 200
    assert res.text == "console.log(1)"


def test_flag_disables_dashboard_serving(tmp_path):
    (tmp_path / "index.html").write_text("<html></html>", encoding="utf-8")
    app = create_app(_settings(frontend_dist=str(tmp_path), serve_frontend=False))
    client = TestClient(app)
    assert client.get("/").status_code == 404
    assert client.get("/health").status_code == 200


def test_flag_env_string_disables_dashboard_serving(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("<html></html>", encoding="utf-8")
    monkeypatch.setenv("SERVE_FRONTEND", "false")
    app = create_app(_settings(frontend_dist=str(tmp_path)))
    client = TestClient(app)
    assert client.get("/").status_code == 404
    assert client.get("/health").status_code == 200
