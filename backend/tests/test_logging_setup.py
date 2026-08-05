import json

from athena.logging_setup import configure_logging, get_logger


def test_logs_are_json_with_context(capsys):
    configure_logging("INFO")
    log = get_logger("test")
    log.info("job done", extra={"job": "ingest_meta_posts", "rows_upserted": 12})
    err = capsys.readouterr().err.strip().splitlines()[-1]
    payload = json.loads(err)
    assert payload["message"] == "job done"
    assert payload["job"] == "ingest_meta_posts"
    assert payload["rows_upserted"] == 12
    assert payload["level"] == "INFO"


def test_respects_level(capsys):
    configure_logging("WARNING")
    get_logger("test").info("should not appear")
    assert capsys.readouterr().err.strip() == ""
