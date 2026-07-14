from fastapi.testclient import TestClient
from athena.api.app import create_app


def test_openapi_documents_endpoints():
    spec = TestClient(create_app()).get("/openapi.json").json()
    assert "/data/own-posts" in spec["paths"]
    assert "/ingest/{source}" in spec["paths"]
    op = spec["paths"]["/data/own-posts"]["get"]
    assert op["summary"] and op["tags"]


def test_own_posts_endpoint_returns_rows(client_with_data):
    resp = client_with_data.get("/data/own-posts?limit=10")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] >= 1
    assert body["items"][0]["platform"] == "instagram"
