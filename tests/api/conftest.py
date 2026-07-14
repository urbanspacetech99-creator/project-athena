import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from athena.api.app import create_app
from athena.api import deps
from athena.db.models import OwnPost


@pytest.fixture
def client_with_db(session):
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    app.dependency_overrides[deps.get_session_factory] = lambda: (lambda: session)
    return TestClient(app)


@pytest.fixture
def client_with_data(session):
    session.add(OwnPost(source_id="ig_1", platform="instagram", title="", content="hi",
                        views=10, likes=2, interactions=3,
                        window_date=datetime(2026, 7, 1, tzinfo=timezone.utc)))
    session.commit()
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    return TestClient(app)
