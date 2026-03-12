from __future__ import annotations

from sqlalchemy import Engine, inspect, text

from app.db.base import Base
from app.models.endpoint import ModelEndpoint


def ensure_schema_compatibility(engine: Engine) -> None:
    inspector = inspect(engine)
    if engine.dialect.name != "sqlite":
        return

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
