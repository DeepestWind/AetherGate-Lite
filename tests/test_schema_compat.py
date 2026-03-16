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


def test_ensure_schema_compatibility_backfills_chat_graph_columns_and_main_branch(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'chat-schema-compat.db'}")

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE chat_conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id VARCHAR(64) NOT NULL,
                    title VARCHAR(200) NOT NULL,
                    title_source VARCHAR(20) NOT NULL,
                    draft_config JSON NOT NULL,
                    last_message_preview TEXT,
                    last_message_role VARCHAR(16),
                    message_count INTEGER NOT NULL DEFAULT 0,
                    last_message_at DATETIME,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE chat_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id VARCHAR(64) NOT NULL,
                    conversation_db_id INTEGER NOT NULL,
                    seq INTEGER NOT NULL,
                    role VARCHAR(16) NOT NULL,
                    content_text TEXT NOT NULL DEFAULT '',
                    status VARCHAR(20) NOT NULL DEFAULT 'completed',
                    strategy VARCHAR(50),
                    request_log_id INTEGER,
                    error_message TEXT,
                    finish_reason VARCHAR(32),
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO chat_conversations (
                    id,
                    conversation_id,
                    title,
                    title_source,
                    draft_config,
                    last_message_preview,
                    last_message_role,
                    message_count,
                    last_message_at,
                    created_at,
                    updated_at
                ) VALUES (
                    1,
                    'conv_legacy',
                    '旧会话',
                    'auto',
                    '{}',
                    NULL,
                    NULL,
                    2,
                    NULL,
                    '2026-03-11 00:00:00',
                    '2026-03-11 00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO chat_messages (
                    id,
                    message_id,
                    conversation_db_id,
                    seq,
                    role,
                    content_text,
                    status,
                    strategy,
                    request_log_id,
                    error_message,
                    finish_reason,
                    created_at,
                    updated_at
                ) VALUES
                    (
                        1,
                        'msg_legacy_user',
                        1,
                        1,
                        'user',
                        '你好',
                        'completed',
                        NULL,
                        NULL,
                        NULL,
                        NULL,
                        '2026-03-11 00:00:00',
                        '2026-03-11 00:00:00'
                    ),
                    (
                        2,
                        'msg_legacy_assistant',
                        1,
                        2,
                        'assistant',
                        '你好，有什么可以帮你？',
                        'completed',
                        NULL,
                        NULL,
                        NULL,
                        'stop',
                        '2026-03-11 00:00:01',
                        '2026-03-11 00:00:01'
                    )
                """
            )
        )

    ensure_schema_compatibility(engine)

    inspector = inspect(engine)
    conversation_columns = {column["name"] for column in inspector.get_columns("chat_conversations")}
    message_columns = {column["name"] for column in inspector.get_columns("chat_messages")}
    branch_columns = {column["name"] for column in inspector.get_columns("chat_branches")}

    assert "active_branch_id" in conversation_columns
    assert {"parent_message_id", "modified_from_message_id", "pinned", "archived", "stale"} <= message_columns
    assert {"branch_id", "head_message_id", "base_message_id"} <= branch_columns

    with engine.begin() as connection:
        messages = connection.execute(
            text(
                """
                SELECT
                    message_id,
                    parent_message_id
                FROM chat_messages
                WHERE conversation_db_id = 1
                ORDER BY seq ASC
                """
            )
        ).mappings().all()
        conversation = connection.execute(
            text(
                """
                SELECT
                    active_branch_id
                FROM chat_conversations
                WHERE id = 1
                """
            )
        ).mappings().one()
        branch = connection.execute(
            text(
                """
                SELECT
                    branch_id,
                    name,
                    head_message_id,
                    base_message_id
                FROM chat_branches
                WHERE conversation_db_id = 1
                """
            )
        ).mappings().one()

    assert messages == [
        {"message_id": "msg_legacy_user", "parent_message_id": None},
        {"message_id": "msg_legacy_assistant", "parent_message_id": "msg_legacy_user"},
    ]
    assert conversation["active_branch_id"] == branch["branch_id"]
    assert branch["name"] == "main"
    assert branch["head_message_id"] == "msg_legacy_assistant"
    assert branch["base_message_id"] == "msg_legacy_user"
