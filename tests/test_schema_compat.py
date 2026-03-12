from sqlalchemy import create_engine, inspect, text

from app.db.schema_compat import ensure_schema_compatibility


def test_ensure_schema_compatibility_makes_endpoint_costs_nullable(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'schema-compat.db'}")

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE model_endpoints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(120) NOT NULL,
                    provider_type VARCHAR(50) NOT NULL,
                    base_url VARCHAR(500) NOT NULL,
                    encrypted_key TEXT,
                    model_name VARCHAR(120) NOT NULL,
                    logical_model VARCHAR(120) NOT NULL,
                    priority INTEGER NOT NULL,
                    weight INTEGER NOT NULL,
                    input_cost_per_1k FLOAT NOT NULL DEFAULT 0.0,
                    output_cost_per_1k FLOAT NOT NULL DEFAULT 0.0,
                    quality_score FLOAT NOT NULL DEFAULT 0.0,
                    is_enabled BOOLEAN NOT NULL DEFAULT 1,
                    is_valid BOOLEAN,
                    last_validated_at DATETIME,
                    remark TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO model_endpoints (
                    id,
                    name,
                    provider_type,
                    base_url,
                    encrypted_key,
                    model_name,
                    logical_model,
                    priority,
                    weight,
                    input_cost_per_1k,
                    output_cost_per_1k,
                    quality_score,
                    is_enabled,
                    is_valid,
                    last_validated_at,
                    remark,
                    created_at,
                    updated_at
                ) VALUES (
                    1,
                    'legacy-endpoint',
                    'openai_compatible',
                    'https://provider.example/v1',
                    NULL,
                    'gpt-4o-mini',
                    'gpt-lite',
                    100,
                    1,
                    0.1,
                    0.2,
                    0.0,
                    1,
                    NULL,
                    NULL,
                    NULL,
                    '2026-03-11 00:00:00',
                    '2026-03-11 00:00:00'
                )
                """
            )
        )

    ensure_schema_compatibility(engine)

    inspector = inspect(engine)
    columns = {column["name"]: column for column in inspector.get_columns("model_endpoints")}

    assert "weight" not in columns
    assert columns["input_cost_per_1k"]["nullable"] is True
    assert columns["output_cost_per_1k"]["nullable"] is True

    with engine.begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT
                    name,
                    input_cost_per_1k,
                    output_cost_per_1k
                FROM model_endpoints
                WHERE id = 1
                """
            )
        ).one()

    assert row.name == "legacy-endpoint"
    assert row.input_cost_per_1k == 0.1
    assert row.output_cost_per_1k == 0.2


def test_ensure_schema_compatibility_recovers_from_interrupted_endpoint_migration(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'schema-recovery.db'}")

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE model_endpoints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(120) NOT NULL,
                    provider_type VARCHAR(50) NOT NULL,
                    base_url VARCHAR(500) NOT NULL,
                    encrypted_key TEXT,
                    model_name VARCHAR(120) NOT NULL,
                    logical_model VARCHAR(120) NOT NULL,
                    priority INTEGER NOT NULL,
                    weight INTEGER NOT NULL,
                    input_cost_per_1k FLOAT,
                    output_cost_per_1k FLOAT,
                    quality_score FLOAT NOT NULL DEFAULT 0.0,
                    is_enabled BOOLEAN NOT NULL DEFAULT 1,
                    is_valid BOOLEAN,
                    last_validated_at DATETIME,
                    remark TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE model_endpoints_legacy (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(120) NOT NULL,
                    provider_type VARCHAR(50) NOT NULL,
                    base_url VARCHAR(500) NOT NULL,
                    encrypted_key TEXT,
                    model_name VARCHAR(120) NOT NULL,
                    logical_model VARCHAR(120) NOT NULL,
                    priority INTEGER NOT NULL,
                    weight INTEGER NOT NULL,
                    input_cost_per_1k FLOAT NOT NULL DEFAULT 0.0,
                    output_cost_per_1k FLOAT NOT NULL DEFAULT 0.0,
                    quality_score FLOAT NOT NULL DEFAULT 0.0,
                    is_enabled BOOLEAN NOT NULL DEFAULT 1,
                    is_valid BOOLEAN,
                    last_validated_at DATETIME,
                    remark TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO model_endpoints_legacy (
                    id,
                    name,
                    provider_type,
                    base_url,
                    encrypted_key,
                    model_name,
                    logical_model,
                    priority,
                    weight,
                    input_cost_per_1k,
                    output_cost_per_1k,
                    quality_score,
                    is_enabled,
                    is_valid,
                    last_validated_at,
                    remark,
                    created_at,
                    updated_at
                ) VALUES (
                    7,
                    'recovered-endpoint',
                    'openai_compatible',
                    'https://provider.example/v1',
                    NULL,
                    'gpt-4o-mini',
                    'gpt-lite',
                    90,
                    1,
                    0.4,
                    0.5,
                    0.0,
                    1,
                    NULL,
                    NULL,
                    NULL,
                    '2026-03-11 00:00:00',
                    '2026-03-11 00:00:00'
                )
                """
            )
        )

    ensure_schema_compatibility(engine)

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert "model_endpoints" in tables
    assert "model_endpoints_legacy" not in tables

    columns = {column["name"]: column for column in inspector.get_columns("model_endpoints")}
    assert "weight" not in columns
    assert columns["input_cost_per_1k"]["nullable"] is True
    assert columns["output_cost_per_1k"]["nullable"] is True

    with engine.begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    priority,
                    input_cost_per_1k,
                    output_cost_per_1k
                FROM model_endpoints
                """
            )
        ).one()

    assert row.id == 7
    assert row.name == "recovered-endpoint"
    assert row.priority == 90
    assert row.input_cost_per_1k == 0.4
    assert row.output_cost_per_1k == 0.5
