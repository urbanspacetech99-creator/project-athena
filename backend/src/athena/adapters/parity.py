from typing import Any


def shape_of(value: Any) -> Any:
    """Structural fingerprint: dict->{k: shape}, list->[shape of first elem], leaf->type name."""
    if isinstance(value, dict):
        return {k: shape_of(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return [shape_of(value[0])] if value else []
    return type(value).__name__


def assert_same_shape(reference: Any, candidate: Any, path: str = "$") -> None:
    """Raise AssertionError if `candidate` deviates structurally from `reference`."""
    ref_shape, cand_shape = shape_of(reference), shape_of(candidate)
    _compare(ref_shape, cand_shape, path)


def _compare(ref: Any, cand: Any, path: str) -> None:
    if isinstance(ref, dict):
        assert isinstance(cand, dict), f"{path}: expected object, got {cand!r}"
        for key in ref:
            assert key in cand, f"{path}.{key}: missing key in candidate"
            _compare(ref[key], cand[key], f"{path}.{key}")
        return
    if isinstance(ref, list):
        assert isinstance(cand, list), f"{path}: expected list, got {cand!r}"
        if ref and cand:
            _compare(ref[0], cand[0], f"{path}[0]")
        return
    assert ref == cand, f"{path}: type mismatch (reference={ref}, candidate={cand})"
