from app.providers.base import ProviderCallError, ProviderChatResult
from app.providers.openai_compatible import OpenAICompatibleProvider


async def _validate_success(self, endpoint):
    return True, f"{endpoint.name} ok"


def test_health_endpoint(client):
    response = client.get("/internal/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_gateway_flow_with_prompt_cache_and_metrics(client, auth_headers, monkeypatch):
    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        return ProviderChatResult(
            content=f"reply-from-{endpoint.name}",
            finish_reason="stop",
            prompt_tokens=12,
            completion_tokens=8,
            total_tokens=20,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)
    monkeypatch.setattr(OpenAICompatibleProvider, "validate_endpoint", _validate_success)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "primary-openai",
            "provider_type": "openai_compatible",
            "base_url": "https://provider.example/v1",
            "api_key": "sk-test-key",
            "model_name": "gpt-4o-mini",
            "logical_model": "gpt-lite",
            "priority": 10,
        },
    )
    assert endpoint_response.status_code == 201
    endpoint_id = endpoint_response.json()["id"]

    validate_response = client.post(
        f"/api/endpoints/{endpoint_id}/validate",
        headers=auth_headers,
    )
    assert validate_response.status_code == 200
    assert validate_response.json()["is_valid"] is True

    prompt_response = client.post(
        "/api/prompts",
        headers=auth_headers,
        json={
            "prompt_id": "assistant.default",
            "name": "Default Assistant",
            "content": "You are helping {name}.",
            "variables": ["name"],
            "description": "test prompt",
        },
    )
    assert prompt_response.status_code == 201

    payload = {
        "model": "gpt-lite",
        "temperature": 0.2,
        "prompt_id": "assistant.default",
        "prompt_variables": {"name": "Cai"},
        "messages": [{"role": "user", "content": "Say hi"}],
    }
    first_response = client.post("/v1/chat/completions", headers=auth_headers, json=payload)
    assert first_response.status_code == 200
    assert first_response.headers["x-aethergate-cache"] == "miss"
    assert first_response.json()["choices"][0]["message"]["content"] == "reply-from-primary-openai"

    second_response = client.post("/v1/chat/completions", headers=auth_headers, json=payload)
    assert second_response.status_code == 200
    assert second_response.headers["x-aethergate-cache"] == "hit"

    models_response = client.get("/v1/models", headers=auth_headers)
    assert models_response.status_code == 200
    assert models_response.json()["data"] == [
        {"id": "gpt-lite", "object": "model", "created": 0, "owned_by": "aethergate-lite"}
    ]

    logs_response = client.get("/internal/logs", headers=auth_headers)
    assert logs_response.status_code == 200
    assert logs_response.json()["total"] == 2
    assert any(item["cache_hit"] is True for item in logs_response.json()["items"])

    metrics_response = client.get("/internal/metrics", headers=auth_headers)
    assert metrics_response.status_code == 200
    assert metrics_response.json()["total_requests"] == 2
    assert metrics_response.json()["cache_hits"] == 1

    stats_response = client.get("/internal/stats", headers=auth_headers)
    assert stats_response.status_code == 200
    assert stats_response.json()["series"][0]["total_requests"] == 2


def test_create_endpoint_preserves_null_costs_when_omitted(client, auth_headers):
    response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "nullable-cost-endpoint",
            "provider_type": "openai_compatible",
            "base_url": "https://provider.example/v1",
            "api_key": "sk-test-key",
            "model_name": "gpt-4o-mini",
            "logical_model": "gpt-lite",
            "priority": 100,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["input_cost_per_1k"] is None
    assert payload["output_cost_per_1k"] is None


def test_gateway_fallback_uses_next_candidate(client, auth_headers, monkeypatch):
    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        if endpoint.name == "primary":
            raise ProviderCallError("upstream_failure", "primary failed")
        return ProviderChatResult(
            content="backup-response",
            finish_reason="stop",
            prompt_tokens=10,
            completion_tokens=5,
            total_tokens=15,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    for name, priority in (("primary", 1), ("backup", 2)):
        response = client.post(
            "/api/endpoints",
            headers=auth_headers,
            json={
                "name": name,
                "provider_type": "openai_compatible",
                "base_url": "https://provider.example/v1",
                "api_key": "sk-test-key",
                "model_name": "gpt-4o-mini",
                "logical_model": "gpt-lite",
                "priority": priority,
            },
        )
        assert response.status_code == 201

    response = client.post(
        "/v1/chat/completions",
        headers=auth_headers,
        json={
            "model": "gpt-lite",
            "temperature": 0.9,
            "messages": [{"role": "user", "content": "hello"}],
            "strategy": "balanced",
        },
    )
    assert response.status_code == 200
    assert response.headers["x-aethergate-fallbacks"] == "1"
    assert response.json()["choices"][0]["message"]["content"] == "backup-response"

    logs_response = client.get("/internal/logs", headers=auth_headers)
    assert logs_response.status_code == 200
    first_item = logs_response.json()["items"][0]
    assert first_item["fallback_count"] == 1
    assert first_item["endpoint_name"] == "backup"


def test_cheapest_strategy_prefers_known_costs_over_null_costs(client, auth_headers, monkeypatch):
    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        return ProviderChatResult(
            content=f"reply-from-{endpoint.name}",
            finish_reason="stop",
            prompt_tokens=10,
            completion_tokens=5,
            total_tokens=15,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    unknown_cost_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "unknown-cost",
            "provider_type": "openai_compatible",
            "base_url": "https://provider.example/v1",
            "api_key": "sk-test-key",
            "model_name": "gpt-4o-mini",
            "logical_model": "gpt-lite",
            "priority": 1,
        },
    )
    assert unknown_cost_response.status_code == 201

    known_cost_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "known-cost",
            "provider_type": "openai_compatible",
            "base_url": "https://provider.example/v1",
            "api_key": "sk-test-key",
            "model_name": "gpt-4o-mini",
            "logical_model": "gpt-lite",
            "priority": 10,
            "input_cost_per_1k": 0.1,
            "output_cost_per_1k": 0.2,
        },
    )
    assert known_cost_response.status_code == 201

    response = client.post(
        "/v1/chat/completions",
        headers=auth_headers,
        json={
            "model": "gpt-lite",
            "temperature": 0.2,
            "messages": [{"role": "user", "content": "hello"}],
            "strategy": "cheapest",
        },
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "reply-from-known-cost"


def test_chat_conversation_persists_messages_and_config(client, auth_headers, monkeypatch):
    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        return ProviderChatResult(
            content="持久化测试回复",
            finish_reason="stop",
            prompt_tokens=18,
            completion_tokens=12,
            total_tokens=30,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-storage-endpoint",
            "provider_type": "openai_compatible",
            "base_url": "https://provider.example/v1",
            "api_key": "sk-test-key",
            "model_name": "gpt-4o-mini",
            "logical_model": "gpt-lite",
            "priority": 10,
        },
    )
    assert endpoint_response.status_code == 201

    draft_config = {
        "model": "gpt-lite",
        "prompt_id": "",
        "strategy": "balanced",
        "temperature": 0,
        "variables": {},
    }
    create_response = client.post(
        "/api/chat/conversations",
        headers=auth_headers,
        json={"draft_config": draft_config},
    )
    assert create_response.status_code == 201

    created = create_response.json()
    conversation_id = created["id"]
    assert created["draft_config"] == draft_config
    assert created["messages"] == []

    send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "帮我记住这条对话",
            "draft_config": draft_config,
        },
    )
    assert send_response.status_code == 200

    sent = send_response.json()
    assert sent["title"] == "帮我记住这条对话"
    assert sent["message_count"] == 2
    assert sent["last_message_role"] == "assistant"
    assert sent["last_message_preview"] == "持久化测试回复"
    assert [message["role"] for message in sent["messages"]] == ["user", "assistant"]
    assert sent["messages"][0]["content"] == "帮我记住这条对话"
    assert sent["messages"][1]["content"] == "持久化测试回复"
    assert sent["messages"][1]["call_info"]["request_id"] != ""
    assert sent["messages"][1]["call_info"]["strategy"] == "balanced"

    list_response = client.get("/api/chat/conversations", headers=auth_headers)
    assert list_response.status_code == 200
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["id"] == conversation_id
    assert listed[0]["message_count"] == 2
    assert listed[0]["draft_config"] == draft_config

    detail_response = client.get(f"/api/chat/conversations/{conversation_id}", headers=auth_headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["messages"][1]["content"] == "持久化测试回复"

    clear_response = client.delete(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
    )
    assert clear_response.status_code == 200
    cleared = clear_response.json()
    assert cleared["messages"] == []
    assert cleared["message_count"] == 0
    assert cleared["draft_config"] == draft_config

    delete_response = client.delete(
        f"/api/chat/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert delete_response.status_code == 204

    final_list_response = client.get("/api/chat/conversations", headers=auth_headers)
    assert final_list_response.status_code == 200
    assert final_list_response.json() == []


def test_chat_conversation_can_be_renamed(client, auth_headers):
    create_response = client.post(
        "/api/chat/conversations",
        headers=auth_headers,
        json={"draft_config": {"model": "", "prompt_id": "", "strategy": "balanced", "temperature": 0, "variables": {}}},
    )
    assert create_response.status_code == 201
    conversation_id = create_response.json()["id"]

    rename_response = client.patch(
        f"/api/chat/conversations/{conversation_id}",
        headers=auth_headers,
        json={"title": "  手动 标题  "},
    )
    assert rename_response.status_code == 200
    assert rename_response.json()["title"] == "手动 标题"

    detail_response = client.get(f"/api/chat/conversations/{conversation_id}", headers=auth_headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["title"] == "手动 标题"


def test_chat_conversation_rename_rejects_empty_title(client, auth_headers):
    create_response = client.post(
        "/api/chat/conversations",
        headers=auth_headers,
        json={"draft_config": {"model": "", "prompt_id": "", "strategy": "balanced", "temperature": 0, "variables": {}}},
    )
    assert create_response.status_code == 201
    conversation_id = create_response.json()["id"]

    rename_response = client.patch(
        f"/api/chat/conversations/{conversation_id}",
        headers=auth_headers,
        json={"title": "   "},
    )
    assert rename_response.status_code == 422


def test_chat_conversation_rename_rejects_overlong_title(client, auth_headers):
    create_response = client.post(
        "/api/chat/conversations",
        headers=auth_headers,
        json={"draft_config": {"model": "", "prompt_id": "", "strategy": "balanced", "temperature": 0, "variables": {}}},
    )
    assert create_response.status_code == 201
    conversation_id = create_response.json()["id"]

    rename_response = client.patch(
        f"/api/chat/conversations/{conversation_id}",
        headers=auth_headers,
        json={"title": "x" * 201},
    )
    assert rename_response.status_code == 422


def test_chat_conversation_rename_returns_404_for_missing_conversation(client, auth_headers):
    rename_response = client.patch(
        "/api/chat/conversations/conv_missing",
        headers=auth_headers,
        json={"title": "新的标题"},
    )
    assert rename_response.status_code == 404
