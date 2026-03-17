import asyncio
import json

from app.db.session import SessionLocal
from app.providers.base import ProviderCallError, ProviderChatResult, ProviderStreamEvent
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.schemas.chat_sessions import ChatConversationConfig
from app.services.chat_sessions import chat_session_service


async def _validate_success(self, endpoint):
    return True, f"{endpoint.name} ok"


def _parse_sse_blocks(lines):
    event_name = None
    data_lines = []

    for line in lines:
        if line == "":
            if data_lines:
                yield {
                    "event": event_name,
                    "data": "\n".join(data_lines),
                }
            event_name = None
            data_lines = []
            continue

        if line.startswith("event: "):
            event_name = line[7:]
            continue
        if line.startswith("data: "):
            data_lines.append(line[6:])

    if data_lines:
        yield {
            "event": event_name,
            "data": "\n".join(data_lines),
        }


def test_health_endpoint(client):
    response = client.get("/internal/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "branchat"


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
    assert first_response.headers["x-branchat-cache"] == "miss"
    assert first_response.json()["choices"][0]["message"]["content"] == "reply-from-primary-openai"

    second_response = client.post("/v1/chat/completions", headers=auth_headers, json=payload)
    assert second_response.status_code == 200
    assert second_response.headers["x-branchat-cache"] == "hit"

    models_response = client.get("/v1/models", headers=auth_headers)
    assert models_response.status_code == 200
    assert models_response.json()["data"] == [
        {"id": "gpt-lite", "object": "model", "created": 0, "owned_by": "branchat"}
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
    assert response.headers["x-branchat-fallbacks"] == "1"
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
    assert created["message_nodes"] == {}
    assert created["active_branch_id"]
    assert created["branches"] == [
        {
            "id": created["active_branch_id"],
            "name": "main",
            "head_message_id": None,
            "base_message_id": None,
        }
    ]

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
    assert sent["messages"][0]["parent_id"] is None
    assert sent["messages"][1]["parent_id"] == sent["messages"][0]["id"]
    assert sent["messages"][1]["call_info"]["request_id"] != ""
    assert sent["messages"][1]["call_info"]["strategy"] == "balanced"
    assert sent["branches"] == [
        {
            "id": sent["active_branch_id"],
            "name": "main",
            "head_message_id": sent["messages"][1]["id"],
            "base_message_id": sent["messages"][0]["id"],
        }
    ]
    assert set(sent["message_nodes"]) == {sent["messages"][0]["id"], sent["messages"][1]["id"]}
    assert sent["message_nodes"][sent["messages"][1]["id"]]["parent_id"] == sent["messages"][0]["id"]

    list_response = client.get("/api/chat/conversations", headers=auth_headers)
    assert list_response.status_code == 200
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["id"] == conversation_id
    assert listed[0]["message_count"] == 2
    assert listed[0]["draft_config"] == draft_config
    assert listed[0]["active_branch_id"] == sent["active_branch_id"]

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


def test_chat_conversation_commit_edits_branch_from_non_leaf_user_before_generation(
    client, auth_headers, monkeypatch
):
    captured_calls = []

    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        captured_calls.append([(message.role, message.content) for message in messages])
        if len(captured_calls) == 1:
            reply = "初始回复"
        elif len(captured_calls) == 2:
            reply = "改写后的首轮回复"
        else:
            reply = "基于改写分支继续回复"
        return ProviderChatResult(
            content=reply,
            finish_reason="stop",
            prompt_tokens=24,
            completion_tokens=16,
            total_tokens=40,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-edit-endpoint",
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
    conversation_id = create_response.json()["id"]

    first_send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "原始问题",
            "draft_config": draft_config,
        },
    )
    assert first_send_response.status_code == 200
    first_payload = first_send_response.json()
    original_user_id = first_payload["messages"][0]["id"]
    original_assistant_id = first_payload["messages"][1]["id"]

    second_send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages/commit",
        headers=auth_headers,
        json={
            "content": "继续分析",
            "draft_config": draft_config,
            "modified_nodes": [
                {
                    "id": original_user_id,
                    "content": "改写后的问题"
                }
            ],
        },
    )
    assert second_send_response.status_code == 200

    second_payload = second_send_response.json()
    assert second_payload["message_count"] == 6
    assert [message["role"] for message in second_payload["messages"]] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    assert second_payload["messages"][0]["content"] == "改写后的问题"
    assert second_payload["messages"][0]["id"] != original_user_id
    assert second_payload["messages"][0]["modified_from"] == original_user_id
    assert second_payload["messages"][1]["content"] == "改写后的首轮回复"
    assert second_payload["messages"][2]["content"] == "继续分析"
    assert second_payload["messages"][3]["content"] == "基于改写分支继续回复"
    assert second_payload["message_nodes"][original_user_id]["content"] == "原始问题"
    assert second_payload["message_nodes"][original_assistant_id]["content"] == "初始回复"
    assert len(second_payload["branches"]) == 2
    assert captured_calls[1] == [("user", "改写后的问题")]
    assert captured_calls[2] == [
        ("user", "改写后的问题"),
        ("assistant", "改写后的首轮回复"),
        ("user", "继续分析"),
    ]


def test_chat_conversation_branch_edit_non_leaf_user_auto_generates_reply(
    client, auth_headers, monkeypatch
):
    captured_calls = []
    replies = iter(["原始回复", "改写后的新回复"])

    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        captured_calls.append([(message.role, message.content) for message in messages])
        return ProviderChatResult(
            content=next(replies),
            finish_reason="stop",
            prompt_tokens=24,
            completion_tokens=16,
            total_tokens=40,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-branch-edit-user-endpoint",
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
    conversation_id = create_response.json()["id"]

    first_send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "原始问题",
            "draft_config": draft_config,
        },
    )
    assert first_send_response.status_code == 200
    first_payload = first_send_response.json()
    original_user_id = first_payload["messages"][0]["id"]

    branch_edit_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages/{original_user_id}/branch-edit",
        headers=auth_headers,
        json={
            "content": "改写后的问题",
            "draft_config": draft_config,
        },
    )
    assert branch_edit_response.status_code == 200
    branch_edit_payload = branch_edit_response.json()

    assert [message["role"] for message in branch_edit_payload["messages"]] == ["user", "assistant"]
    assert branch_edit_payload["messages"][0]["content"] == "改写后的问题"
    assert branch_edit_payload["messages"][0]["id"] != original_user_id
    assert branch_edit_payload["messages"][0]["modified_from"] == original_user_id
    assert branch_edit_payload["messages"][1]["content"] == "改写后的新回复"
    assert branch_edit_payload["message_nodes"][original_user_id]["content"] == "原始问题"
    assert len(branch_edit_payload["branches"]) == 2
    assert captured_calls[-1] == [("user", "改写后的问题")]


def test_chat_conversation_regenerate_creates_assistant_sibling_and_moves_branch(
    client, auth_headers, monkeypatch
):
    captured_calls = []

    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        captured_calls.append([(message.role, message.content) for message in messages])
        reply = "第一版回答" if len(captured_calls) == 1 else "重新生成后的回答"
        return ProviderChatResult(
            content=reply,
            finish_reason="stop",
            prompt_tokens=24,
            completion_tokens=16,
            total_tokens=40,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-regenerate-endpoint",
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
    conversation_id = create_response.json()["id"]

    first_send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "解释这个概念",
            "draft_config": draft_config,
        },
    )
    assert first_send_response.status_code == 200
    first_payload = first_send_response.json()
    original_user_id = first_payload["messages"][0]["id"]
    original_assistant_id = first_payload["messages"][1]["id"]

    regenerate_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages/{original_assistant_id}/regenerate",
        headers=auth_headers,
        json={"draft_config": draft_config, "modified_nodes": []},
    )
    assert regenerate_response.status_code == 200

    regenerated_payload = regenerate_response.json()
    assert regenerated_payload["message_count"] == 3
    assert [message["role"] for message in regenerated_payload["messages"]] == ["user", "assistant"]
    assert regenerated_payload["messages"][0]["id"] == original_user_id
    assert regenerated_payload["messages"][0]["content"] == "解释这个概念"
    assert regenerated_payload["messages"][1]["id"] != original_assistant_id
    assert regenerated_payload["messages"][1]["content"] == "重新生成后的回答"
    assert regenerated_payload["messages"][1]["parent_id"] == original_user_id
    assert regenerated_payload["branches"] == [
        {
            "id": regenerated_payload["active_branch_id"],
            "name": "main",
            "head_message_id": regenerated_payload["messages"][1]["id"],
            "base_message_id": original_user_id,
        }
    ]
    assert set(regenerated_payload["message_nodes"]) == {
        original_user_id,
        original_assistant_id,
        regenerated_payload["messages"][1]["id"],
    }
    assert regenerated_payload["message_nodes"][original_assistant_id]["content"] == "第一版回答"
    assert regenerated_payload["message_nodes"][regenerated_payload["messages"][1]["id"]]["content"] == "重新生成后的回答"
    assert captured_calls == [
        [("user", "解释这个概念")],
        [("user", "解释这个概念")],
    ]


def test_chat_conversation_can_select_assistant_variant_without_resetting_branch_head(
    client, auth_headers, monkeypatch
):
    replies = iter(["第一版回答", "第二版回答"])

    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        return ProviderChatResult(
            content=next(replies),
            finish_reason="stop",
            prompt_tokens=24,
            completion_tokens=16,
            total_tokens=40,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-select-variant-endpoint",
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
    conversation_id = create_response.json()["id"]

    first_send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "给我两个版本",
            "draft_config": draft_config,
        },
    )
    assert first_send_response.status_code == 200
    original_payload = first_send_response.json()
    original_assistant_id = original_payload["messages"][1]["id"]

    regenerate_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages/{original_assistant_id}/regenerate",
        headers=auth_headers,
        json={"draft_config": draft_config, "modified_nodes": []},
    )
    assert regenerate_response.status_code == 200
    regenerated_payload = regenerate_response.json()
    regenerated_assistant_id = regenerated_payload["messages"][1]["id"]

    select_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages/{original_assistant_id}/select",
        headers=auth_headers,
    )
    assert select_response.status_code == 200
    selected_payload = select_response.json()
    assert selected_payload["messages"][1]["id"] == original_assistant_id
    assert selected_payload["messages"][1]["content"] == "第一版回答"
    assert selected_payload["branches"] == [
        {
            "id": selected_payload["active_branch_id"],
            "name": "main",
            "head_message_id": original_assistant_id,
            "base_message_id": selected_payload["messages"][0]["id"],
        }
    ]

    detail_response = client.get(
        f"/api/chat/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["messages"][1]["id"] == original_assistant_id
    assert detail_payload["messages"][1]["content"] == "第一版回答"
    assert detail_payload["message_nodes"][regenerated_assistant_id]["content"] == "第二版回答"


def test_chat_conversation_can_create_and_activate_branch_from_existing_node(
    client, auth_headers, monkeypatch
):
    replies = iter(["第一版回答", "第二版回答"])

    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        return ProviderChatResult(
            content=next(replies),
            finish_reason="stop",
            prompt_tokens=24,
            completion_tokens=16,
            total_tokens=40,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-branch-endpoint",
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
    conversation_id = create_response.json()["id"]

    first_send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "第一条问题",
            "draft_config": draft_config,
        },
    )
    assert first_send_response.status_code == 200
    first_payload = first_send_response.json()
    main_branch_id = first_payload["active_branch_id"]
    first_user_id = first_payload["messages"][0]["id"]

    second_send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "继续追问",
            "draft_config": draft_config,
        },
    )
    assert second_send_response.status_code == 200
    second_payload = second_send_response.json()
    assert [message["content"] for message in second_payload["messages"]] == [
        "第一条问题",
        "第一版回答",
        "继续追问",
        "第二版回答",
    ]

    create_branch_response = client.post(
        f"/api/chat/conversations/{conversation_id}/branches",
        headers=auth_headers,
        json={"base_message_id": first_user_id},
    )
    assert create_branch_response.status_code == 200
    branch_payload = create_branch_response.json()
    assert branch_payload["active_branch_id"] != main_branch_id
    assert [message["id"] for message in branch_payload["messages"]] == [first_user_id]
    assert branch_payload["branches"] == [
        {
            "id": main_branch_id,
            "name": "main",
            "head_message_id": second_payload["messages"][3]["id"],
            "base_message_id": first_user_id,
        },
        {
            "id": branch_payload["active_branch_id"],
            "name": "branch-2",
            "head_message_id": first_user_id,
            "base_message_id": first_user_id,
        },
    ]

    activate_response = client.post(
        f"/api/chat/conversations/{conversation_id}/branches/{main_branch_id}/activate",
        headers=auth_headers,
    )
    assert activate_response.status_code == 200
    activated_payload = activate_response.json()
    assert activated_payload["active_branch_id"] == main_branch_id
    assert [message["content"] for message in activated_payload["messages"]] == [
        "第一条问题",
        "第一版回答",
        "继续追问",
        "第二版回答",
    ]


def test_chat_conversation_regenerate_non_leaf_assistant_keeps_active_path(
    client, auth_headers, monkeypatch
):
    replies = iter(["第一版回答", "第二版回答", "历史回答新版本"])

    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        return ProviderChatResult(
            content=next(replies),
            finish_reason="stop",
            prompt_tokens=24,
            completion_tokens=16,
            total_tokens=40,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-history-retry-endpoint",
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
    conversation_id = create_response.json()["id"]

    first_send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "第一条问题",
            "draft_config": draft_config,
        },
    )
    assert first_send_response.status_code == 200
    first_payload = first_send_response.json()
    first_assistant_id = first_payload["messages"][1]["id"]

    second_send_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "继续追问",
            "draft_config": draft_config,
        },
    )
    assert second_send_response.status_code == 200
    second_payload = second_send_response.json()
    current_head_id = second_payload["messages"][3]["id"]

    regenerate_response = client.post(
        f"/api/chat/conversations/{conversation_id}/messages/{first_assistant_id}/regenerate",
        headers=auth_headers,
        json={"draft_config": draft_config, "modified_nodes": []},
    )
    assert regenerate_response.status_code == 200
    regenerated_payload = regenerate_response.json()

    assert regenerated_payload["branches"] == [
        {
            "id": regenerated_payload["active_branch_id"],
            "name": "main",
            "head_message_id": current_head_id,
            "base_message_id": second_payload["messages"][0]["id"],
        }
    ]
    assert [message["content"] for message in regenerated_payload["messages"]] == [
        "第一条问题",
        "第一版回答",
        "继续追问",
        "第二版回答",
    ]
    new_history_siblings = [
        message
        for message in regenerated_payload["message_nodes"].values()
        if message["parent_id"] == second_payload["messages"][0]["id"]
        and message["role"] == "assistant"
    ]
    assert len(new_history_siblings) == 2
    assert sorted(message["content"] for message in new_history_siblings) == [
        "历史回答新版本",
        "第一版回答",
    ]


def test_chat_conversation_compresses_context_with_summary_using_medium_default(
    client, auth_headers, monkeypatch
):
    captured_calls = []
    replies = iter(["第一轮回答" * 160, "第二轮回答" * 160, "第三轮回答" * 160])

    def fake_approximate_tokens(text):
        if not text:
            return 0
        if text.startswith("历史摘要"):
            return 200
        return len(text) * 50

    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        captured_calls.append([(message.role, message.content) for message in messages])
        return ProviderChatResult(
            content=next(replies),
            finish_reason="stop",
            prompt_tokens=24,
            completion_tokens=16,
            total_tokens=40,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr("app.services.chat_sessions.approximate_tokens", fake_approximate_tokens)
    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-compression-endpoint",
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
    conversation_id = create_response.json()["id"]

    first_send = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "第一轮问题" * 160,
            "draft_config": draft_config,
        },
    )
    assert first_send.status_code == 200

    second_send = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "第二轮问题" * 160,
            "draft_config": draft_config,
        },
    )
    assert second_send.status_code == 200
    second_payload = second_send.json()
    assert not any(node["role"] == "summary" for node in second_payload["message_nodes"].values())

    third_send = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "第三轮问题" * 160,
            "draft_config": draft_config,
        },
    )
    assert third_send.status_code == 200
    third_payload = third_send.json()

    summary_messages = [
        message for message in third_payload["visible_messages"] if message["kind"] == "summary"
    ]
    assert len(summary_messages) == 1
    assert summary_messages[0]["role"] == "summary"
    assert not any(node["role"] == "summary" for node in third_payload["message_nodes"].values())
    assert [message["role"] for message in third_payload["visible_messages"]] == [
        "summary",
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    assert any(role == "system" for role, _ in captured_calls[-1])


def test_chat_conversation_pinned_message_is_excluded_from_compression(
    client, auth_headers, monkeypatch
):
    replies = iter(["第一轮回答" * 160, "第二轮回答" * 160, "第三轮回答" * 160])

    def fake_approximate_tokens(text):
        if not text:
            return 0
        if text.startswith("历史摘要"):
            return 200
        return len(text) * 50

    async def fake_chat(self, endpoint, messages, temperature, max_tokens):
        return ProviderChatResult(
            content=next(replies),
            finish_reason="stop",
            prompt_tokens=24,
            completion_tokens=16,
            total_tokens=40,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr("app.services.chat_sessions.approximate_tokens", fake_approximate_tokens)
    monkeypatch.setattr(OpenAICompatibleProvider, "chat_completions", fake_chat)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-pin-endpoint",
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
    conversation_id = create_response.json()["id"]

    first_send = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "第一轮问题" * 160,
            "draft_config": draft_config,
        },
    )
    assert first_send.status_code == 200
    first_payload = first_send.json()
    first_assistant_id = first_payload["messages"][1]["id"]

    pin_response = client.patch(
        f"/api/chat/conversations/{conversation_id}/messages/{first_assistant_id}/pin",
        headers=auth_headers,
        json={"pinned": True},
    )
    assert pin_response.status_code == 200
    assert pin_response.json()["message_nodes"][first_assistant_id]["pinned"] is True

    second_send = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "第二轮问题" * 160,
            "draft_config": draft_config,
        },
    )
    assert second_send.status_code == 200

    third_send = client.post(
        f"/api/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={
            "content": "第三轮问题" * 160,
            "draft_config": draft_config,
        },
    )
    assert third_send.status_code == 200
    third_payload = third_send.json()

    assert not any(node["role"] == "summary" for node in third_payload["message_nodes"].values())
    assert third_payload["message_nodes"][first_assistant_id]["pinned"] is True
    assert third_payload["message_nodes"][first_assistant_id]["archived"] is False
    assert [message["role"] for message in third_payload["visible_messages"]] == [
        "summary",
        "assistant",
        "user",
        "assistant",
        "user",
        "assistant",
    ]


def test_gateway_streaming_returns_openai_style_sse(client, auth_headers, monkeypatch):
    async def fake_stream(self, endpoint, messages, temperature, max_tokens, cancel_event=None):
        yield ProviderStreamEvent(delta="你好", actual_model=endpoint.model_name)
        yield ProviderStreamEvent(delta="，世界")
        yield ProviderStreamEvent(
            finish_reason="stop",
            prompt_tokens=10,
            completion_tokens=4,
            total_tokens=14,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "stream_chat_completions", fake_stream)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "public-stream-endpoint",
            "provider_type": "openai_compatible",
            "base_url": "https://provider.example/v1",
            "api_key": "sk-test-key",
            "model_name": "gpt-4o-mini",
            "logical_model": "gpt-lite",
            "priority": 10,
        },
    )
    assert endpoint_response.status_code == 201

    with client.stream(
        "POST",
        "/v1/chat/completions",
        headers=auth_headers,
        json={
            "model": "gpt-lite",
            "temperature": 0,
            "stream": True,
            "messages": [{"role": "user", "content": "你好"}],
        },
    ) as response:
        assert response.status_code == 200
        blocks = list(_parse_sse_blocks(response.iter_lines()))

    assert response.headers["x-branchat-cache"] == "miss"
    assert json.loads(blocks[0]["data"])["choices"][0]["delta"] == {"role": "assistant"}
    assert json.loads(blocks[1]["data"])["choices"][0]["delta"] == {"content": "你好"}
    assert json.loads(blocks[2]["data"])["choices"][0]["delta"] == {"content": "，世界"}
    assert json.loads(blocks[3]["data"])["choices"][0]["finish_reason"] == "stop"
    assert blocks[4]["data"] == "[DONE]"


def test_chat_conversation_streaming_route_emits_sse_events_and_persists(
    client, auth_headers, monkeypatch
):
    async def fake_stream(self, endpoint, messages, temperature, max_tokens, cancel_event=None):
        yield ProviderStreamEvent(delta="第一段", actual_model=endpoint.model_name)
        yield ProviderStreamEvent(delta="第二段")
        yield ProviderStreamEvent(
            finish_reason="stop",
            prompt_tokens=12,
            completion_tokens=6,
            total_tokens=18,
            actual_model=endpoint.model_name,
        )

    monkeypatch.setattr(OpenAICompatibleProvider, "stream_chat_completions", fake_stream)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-stream-endpoint",
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
    conversation_id = create_response.json()["id"]

    with client.stream(
        "POST",
        f"/api/chat/conversations/{conversation_id}/messages/stream",
        headers=auth_headers,
        json={
            "content": "请流式回复",
            "draft_config": draft_config,
        },
    ) as response:
        assert response.status_code == 200
        blocks = list(_parse_sse_blocks(response.iter_lines()))

    event_names = [block["event"] for block in blocks]
    assert event_names == [
        "message.created",
        "message.meta",
        "message.delta",
        "message.delta",
        "message.completed",
    ]
    assert json.loads(blocks[2]["data"])["delta"] == "第一段"
    assert json.loads(blocks[3]["data"])["content"] == "第一段第二段"

    completed_payload = json.loads(blocks[4]["data"])
    conversation = completed_payload["conversation"]
    assert [message["role"] for message in conversation["messages"]] == ["user", "assistant"]
    assert conversation["messages"][1]["content"] == "第一段第二段"
    assert conversation["messages"][1]["status"] == "completed"

    detail_response = client.get(f"/api/chat/conversations/{conversation_id}", headers=auth_headers)
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["messages"][1]["content"] == "第一段第二段"
    assert detail_payload["messages"][1]["call_info"]["status"] == "success"


def test_chat_conversation_stop_generation_marks_message_stopped(client, auth_headers, monkeypatch):
    async def fake_stream(self, endpoint, messages, temperature, max_tokens, cancel_event=None):
        yield ProviderStreamEvent(delta="部分回答", actual_model=endpoint.model_name)
        while cancel_event is None or not cancel_event.is_set():
            await asyncio.sleep(0.01)

    monkeypatch.setattr(OpenAICompatibleProvider, "stream_chat_completions", fake_stream)

    endpoint_response = client.post(
        "/api/endpoints",
        headers=auth_headers,
        json={
            "name": "chat-stop-endpoint",
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
    conversation_id = create_response.json()["id"]

    async def collect_events():
        events = []
        assistant_message_id = None
        with SessionLocal() as db:
            async for event in chat_session_service.stream_send_message(
                db,
                conversation_id,
                "请在中途停止",
                ChatConversationConfig.model_validate(draft_config),
            ):
                events.append(event)
                if event.kind == "message.created":
                    assistant_message_id = event.assistant_message_id
                if event.kind == "message.delta" and assistant_message_id is not None:
                    stop_response = client.post(
                        f"/api/chat/conversations/{conversation_id}/messages/{assistant_message_id}/stop",
                        headers=auth_headers,
                    )
                    assert stop_response.status_code == 204
        return events

    events = asyncio.run(collect_events())
    stopped_event = next(event for event in events if event.kind == "message.stopped")
    assert stopped_event.conversation is not None
    stopped_messages = stopped_event.conversation.messages
    assert stopped_messages[0].role == "user"
    assert stopped_messages[1].content_text == "部分回答"
    assert stopped_messages[1].status == "stopped"

    detail_response = client.get(f"/api/chat/conversations/{conversation_id}", headers=auth_headers)
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["messages"][1]["content"] == "部分回答"
    assert detail_payload["messages"][1]["status"] == "stopped"
    assert detail_payload["messages"][1]["call_info"]["status"] == "cancelled"


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
