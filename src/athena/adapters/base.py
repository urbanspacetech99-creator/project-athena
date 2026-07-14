from abc import ABC, abstractmethod
from typing import Any, Literal

SourceMode = Literal["live", "fixture"]


def raise_on_error_envelope(body: Any, api: str) -> Any:
    """APIs return an {"error": {...}} envelope on failure; treating that as an empty
    result would silently normalize to zero rows. Raise instead. Returns `body`
    unchanged when it is not an error envelope, so call sites can wrap `.json()`."""
    if isinstance(body, dict) and "error" in body:
        err = body["error"]
        message = err.get("message") if isinstance(err, dict) else err
        raise RuntimeError(f"{api} error: {message}")
    return body


class SourceAdapter(ABC):
    """One external source, two interchangeable backends.

    Subclasses set `source` and implement fetch_live / fetch_fixture / normalize.
    `fetch_live` and `fetch_fixture` MUST return the SAME shape (the documented
    live API response); `normalize` consumes that shape for both modes. This is
    what the parity harness (Task 5) enforces.
    """

    source: str = ""

    def __init__(self, mode: SourceMode):
        if not self.source:
            raise NotImplementedError("Adapter subclass must set `source`")
        if mode not in ("live", "fixture"):
            raise ValueError(f"invalid mode: {mode!r}")
        self.mode = mode

    @abstractmethod
    def fetch_live(self, **kwargs: Any) -> Any: ...

    @abstractmethod
    def fetch_fixture(self, **kwargs: Any) -> Any: ...

    @abstractmethod
    def normalize(self, raw: Any) -> list[Any]: ...

    def fetch(self, **kwargs: Any) -> Any:
        return self.fetch_live(**kwargs) if self.mode == "live" else self.fetch_fixture(**kwargs)

    def fetch_normalized(self, **kwargs: Any) -> list[Any]:
        return self.normalize(self.fetch(**kwargs))
