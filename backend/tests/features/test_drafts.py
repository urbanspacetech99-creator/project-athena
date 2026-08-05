from athena.features import drafts


def test_create_and_list_and_get(session):
    d = drafts.create_draft(session, platform="instagram", caption="hello",
                            image_b64="QUJD", canva_edit_url="https://canva/x")
    assert d.id is not None
    assert [x.id for x in drafts.list_drafts(session)] == [d.id]
    got = drafts.get_draft(session, d.id)
    assert got.caption == "hello" and got.image_b64 == "QUJD"


def test_get_missing_returns_none(session):
    assert drafts.get_draft(session, 9999) is None


def test_update_draft(session):
    d = drafts.create_draft(session, platform="facebook", caption="old")
    updated = drafts.update_draft(session, d.id, caption="new", platform="instagram")
    assert updated.caption == "new" and updated.platform == "instagram"


def test_update_missing_returns_none(session):
    assert drafts.update_draft(session, 9999, caption="x") is None


def test_delete_draft(session):
    d = drafts.create_draft(session, platform="instagram", caption="bye")
    assert drafts.delete_draft(session, d.id) is True
    assert drafts.get_draft(session, d.id) is None
    assert drafts.delete_draft(session, d.id) is False
