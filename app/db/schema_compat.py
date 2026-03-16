from __future__ import annotations

from sqlalchemy import Engine, inspect, text

from app.db.base import Base
from app.models.chat_session import ChatBranch
from app.models.endpoint import ModelEndpoint


def ensure_schema_compatibility(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    _ensure_endpoint_schema_compatibility(engine)
    _ensure_chat_schema_compatibility(engine)


def _ensure_endpoint_schema_compatibility(engine: Engine) -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    has_current_table = "model_endpoints" in table_names
    has_legacy_table = "model_endpoints_legacy" in table_names
    if not has_current_table and not has_legacy_table:
        return

    current_needs_migration = False
    if has_current_table:
        columns = {column["name"]: column for column in inspector.get_columns("model_endpoints")}
        current_needs_migration = (
            "weight" in columns
            or not columns.get("input_cost_per_1k", {}).get("nullable")
            or not columns.get("output_cost_per_1k", {}).get("nullable")
        )

    if not has_legacy_table and not current_needs_migration:
        return

    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        try:
            if not has_legacy_table and has_current_table:
                connection.execute(text("ALTER TABLE model_endpoints RENAME TO model_endpoints_legacy"))
                has_legacy_table = True
                has_current_table = False

            if has_current_table:
                connection.execute(text("DROP TABLE model_endpoints"))

            for index in ModelEndpoint.__table__.indexes:
                connection.execute(text(f'DROP INDEX IF EXISTS "{index.name}"'))

            Base.metadata.create_all(bind=connection, tables=[ModelEndpoint.__table__])

            if has_legacy_table:
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
                            input_cost_per_1k,
                            output_cost_per_1k,
                            quality_score,
                            is_enabled,
                            is_valid,
                            last_validated_at,
                            remark,
                            created_at,
                            updated_at
                        )
                        SELECT
                            id,
                            name,
                            provider_type,
                            base_url,
                            encrypted_key,
                            model_name,
                            logical_model,
                            priority,
                            input_cost_per_1k,
                            output_cost_per_1k,
                            quality_score,
                            is_enabled,
                            is_valid,
                            last_validated_at,
                            remark,
                            created_at,
                            updated_at
                        FROM model_endpoints_legacy
                        """
                    )
                )
                connection.execute(text("DROP TABLE model_endpoints_legacy"))
        finally:
            connection.execute(text("PRAGMA foreign_keys=ON"))


def _ensure_chat_schema_compatibility(engine: Engine) -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "chat_conversations" not in table_names or "chat_messages" not in table_names:
        return

    conversation_columns = {column["name"] for column in inspector.get_columns("chat_conversations")}
    message_columns = {column["name"] for column in inspector.get_columns("chat_messages")}

    with engine.begin() as connection:
        if "active_branch_id" not in conversation_columns:
            connection.execute(text("ALTER TABLE chat_conversations ADD COLUMN active_branch_id VARCHAR(64)"))
        _ensure_index(
            connection,
            "ix_chat_conversations_active_branch_id",
            "chat_conversations",
            "active_branch_id",
        )

        if "parent_message_id" not in message_columns:
            connection.execute(text("ALTER TABLE chat_messages ADD COLUMN parent_message_id VARCHAR(64)"))
        if "modified_from_message_id" not in message_columns:
            connection.execute(
                text("ALTER TABLE chat_messages ADD COLUMN modified_from_message_id VARCHAR(64)")
            )
        if "pinned" not in message_columns:
            connection.execute(text("ALTER TABLE chat_messages ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT 0"))
        if "archived" not in message_columns:
            connection.execute(text("ALTER TABLE chat_messages ADD COLUMN archived BOOLEAN NOT NULL DEFAULT 0"))
        if "stale" not in message_columns:
            connection.execute(text("ALTER TABLE chat_messages ADD COLUMN stale BOOLEAN NOT NULL DEFAULT 0"))

        _ensure_index(connection, "ix_chat_messages_parent_message_id", "chat_messages", "parent_message_id")
        _ensure_index(
            connection,
            "ix_chat_messages_modified_from_message_id",
            "chat_messages",
            "modified_from_message_id",
        )
        _ensure_index(connection, "ix_chat_messages_archived", "chat_messages", "archived")
        _ensure_index(connection, "ix_chat_messages_stale", "chat_messages", "stale")

        Base.metadata.create_all(bind=connection, tables=[ChatBranch.__table__])
        _backfill_chat_graph_state(connection)


def _ensure_index(connection, name: str, table: str, column: str) -> None:
    connection.execute(text(f'CREATE INDEX IF NOT EXISTS "{name}" ON {table} ({column})'))


def _backfill_chat_graph_state(connection) -> None:
    conversations = connection.execute(
        text(
            """
            SELECT
                id,
                conversation_id,
                active_branch_id
            FROM chat_conversations
            """
        )
    ).mappings().all()

    for conversation in conversations:
        messages = connection.execute(
            text(
                """
                SELECT
                    id,
                    message_id,
                    seq,
                    parent_message_id
                FROM chat_messages
                WHERE conversation_db_id = :conversation_db_id
                ORDER BY seq ASC, id ASC
                """
            ),
            {"conversation_db_id": conversation["id"]},
        ).mappings().all()

        if len(messages) > 1 and all(not message["parent_message_id"] for message in messages[1:]):
            previous_id = None
            for message in messages:
                connection.execute(
                    text(
                        """
                        UPDATE chat_messages
                        SET parent_message_id = :parent_message_id
                        WHERE id = :id
                        """
                    ),
                    {
                        "parent_message_id": previous_id,
                        "id": message["id"],
                    },
                )
                previous_id = message["message_id"]

        head_message_id = messages[-1]["message_id"] if messages else None
        base_message_id = messages[0]["message_id"] if messages else None
        branch = connection.execute(
            text(
                """
                SELECT
                    id,
                    branch_id,
                    head_message_id,
                    base_message_id
                FROM chat_branches
                WHERE conversation_db_id = :conversation_db_id
                ORDER BY created_at ASC, id ASC
                LIMIT 1
                """
            ),
            {"conversation_db_id": conversation["id"]},
        ).mappings().first()

        branch_id = branch["branch_id"] if branch else conversation["active_branch_id"] or f"branch_main_{conversation['conversation_id']}"

        if branch is None:
            connection.execute(
                text(
                    """
                    INSERT INTO chat_branches (
                        branch_id,
                        conversation_db_id,
                        name,
                        head_message_id,
                        base_message_id,
                        created_at,
                        updated_at
                    ) VALUES (
                        :branch_id,
                        :conversation_db_id,
                        'main',
                        :head_message_id,
                        :base_message_id,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    """
                ),
                {
                    "branch_id": branch_id,
                    "conversation_db_id": conversation["id"],
                    "head_message_id": head_message_id,
                    "base_message_id": base_message_id,
                },
            )
        else:
            if branch["head_message_id"] != head_message_id:
                connection.execute(
                    text(
                        """
                        UPDATE chat_branches
                        SET head_message_id = :head_message_id,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :id
                        """
                    ),
                    {
                        "head_message_id": head_message_id,
                        "id": branch["id"],
                    },
                )
            if branch["base_message_id"] is None and base_message_id is not None:
                connection.execute(
                    text(
                        """
                        UPDATE chat_branches
                        SET base_message_id = :base_message_id,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :id
                        """
                    ),
                    {
                        "base_message_id": base_message_id,
                        "id": branch["id"],
                    },
                )

        if conversation["active_branch_id"] != branch_id:
            connection.execute(
                text(
                    """
                    UPDATE chat_conversations
                    SET active_branch_id = :active_branch_id
                    WHERE id = :id
                    """
                ),
                {
                    "active_branch_id": branch_id,
                    "id": conversation["id"],
                },
            )
