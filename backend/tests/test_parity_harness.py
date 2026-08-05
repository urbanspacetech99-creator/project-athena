import pytest

from athena.adapters.parity import assert_same_shape, shape_of


def test_shape_of_captures_keys_and_types():
    assert shape_of({"a": 1, "b": [{"c": "x"}]}) == {
        "a": "int",
        "b": [{"c": "str"}],
    }


def test_same_shape_passes_for_matching_structure():
    live = {"data": [{"id": "1", "views": 10}], "paging": {"next": "url"}}
    fixture = {"data": [{"id": "2", "views": 99}], "paging": {"next": "url2"}}
    assert_same_shape(live, fixture)  # values differ, shape matches -> no raise


def test_same_shape_fails_on_missing_key():
    live = {"data": [{"id": "1", "views": 10}]}
    fixture = {"data": [{"id": "2"}]}  # missing 'views'
    with pytest.raises(AssertionError, match="views"):
        assert_same_shape(live, fixture)


def test_same_shape_fails_on_type_mismatch():
    live = {"count": 10}
    fixture = {"count": "10"}  # int vs str
    with pytest.raises(AssertionError, match="count"):
        assert_same_shape(live, fixture)
