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
            "weight": 1,
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
                "weight": 1,
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
