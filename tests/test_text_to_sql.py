"""
Unit tests for Text-to-SQL validation and read-only execution security.
"""

import pytest
import sqlite3
import pandas as pd
from src.agent.text_to_sql import validate_sql, execute_readonly
from src.db import init_db, get_db_path


def test_validate_sql_accepts_valid_select():
    valid_queries = [
        "SELECT * FROM neo_observations LIMIT 10",
        "SELECT entity_id, name FROM view_hazardous WHERE miss_distance_km < 1000000;",
        "SELECT COUNT(*) AS total FROM view_minable"
    ]
    for q in valid_queries:
        is_valid, reason = validate_sql(q)
        assert is_valid is True, f"Expected valid query for '{q}', got: {reason}"


def test_validate_sql_rejects_dangerous_keywords():
    dangerous_queries = [
        "DROP TABLE neo_observations;",
        "DELETE FROM priority_scores WHERE id = 1;",
        "UPDATE neo_observations SET is_hazardous = 0;",
        "INSERT INTO pipeline_runs VALUES ('1', '2', '3');",
        "ALTER TABLE neo_observations ADD COLUMN hacked TEXT;",
        "ATTACH DATABASE 'malicious.db' AS mal;",
        "PRAGMA foreign_keys = OFF;"
    ]
    for q in dangerous_queries:
        is_valid, reason = validate_sql(q)
        assert is_valid is False, f"Expected rejection for '{q}'"


def test_validate_sql_rejects_multiple_statements():
    multiple_stmts = "SELECT * FROM neo_observations; DROP TABLE sentry_scores;"
    is_valid, reason = validate_sql(multiple_stmts)
    assert is_valid is False
    assert "Injections" in reason or "point-virgule" in reason


def test_execute_readonly_guarantee():
    """Verifies that execute_readonly physical mode=ro connection forbids any write statement."""
    init_db()
    db_path = str(get_db_path().resolve()).replace("\\", "/")

    # Valid read-only query succeeds
    df = execute_readonly("SELECT 1 AS test_val;", db_path=db_path)
    assert not df.empty
    assert df.iloc[0]["test_val"] == 1

    # Attempting to write even if passed directly to execute_readonly MUST raise OperationalError (attempt to write a readonly database)
    with pytest.raises(Exception):
        execute_readonly("CREATE TABLE unauthorized_test (id INT);", db_path=db_path)
