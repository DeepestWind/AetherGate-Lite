import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.auth import require_bearer_token
from app.db.session import get_db
from app.schemas.chat import ChatCompletionRequest, ModelsResponse, ModelDescriptor
from app.services.gateway import gateway_service

router = APIRouter(tags=["gateway"], dependencies=[Depends(require_bearer_token)])


@router.post("/v1/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    http_request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    if request.stream:
        cancel_event = asyncio.Event()
        stream_session = await gateway_service.begin_chat_stream(
            db,
            request,
            cancel_event=cancel_event,
        )

        async def event_stream():
            role_chunk = {
                "id": f"chatcmpl-{stream_session.request_id}",
                "object": "chat.completion.chunk",
                "created": int(datetime.now(timezone.utc).timestamp()),
                "model": request.model,
                "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
            }
            yield f"data: {json.dumps(role_chunk, ensure_ascii=False)}\n\n"
            if await http_request.is_disconnected():
                cancel_event.set()
                return
            async for event in gateway_service.iterate_chat_stream(db, stream_session):
                if event.kind == "delta":
                    chunk = {
                        "id": f"chatcmpl-{stream_session.request_id}",
                        "object": "chat.completion.chunk",
                        "created": int(datetime.now(timezone.utc).timestamp()),
                        "model": request.model,
                        "choices": [
                            {
                                "index": 0,
                                "delta": {"content": event.delta},
                                "finish_reason": None,
                            }
                        ],
                    }
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                    if await http_request.is_disconnected():
                        cancel_event.set()
                        break
                    continue
                if event.kind == "completed" or event.kind == "cancelled":
                    chunk = {
                        "id": f"chatcmpl-{stream_session.request_id}",
                        "object": "chat.completion.chunk",
                        "created": int(datetime.now(timezone.utc).timestamp()),
                        "model": request.model,
                        "choices": [
                            {"index": 0, "delta": {}, "finish_reason": event.finish_reason or "stop"}
                        ],
                    }
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                return

        stream_response = StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                **stream_session.headers,
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
        return stream_response

    result = await gateway_service.handle_chat(db, request)
    for name, value in result.headers.items():
        response.headers[name] = value
    return result.response


@router.get("/v1/models", response_model=ModelsResponse)
def list_models(db: Session = Depends(get_db)):
    return ModelsResponse(
        data=[ModelDescriptor(id=model_id) for model_id in gateway_service.list_models(db)],
    )
