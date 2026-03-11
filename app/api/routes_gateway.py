from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.auth import require_bearer_token
from app.db.session import get_db
from app.schemas.chat import ChatCompletionRequest, ModelsResponse, ModelDescriptor
from app.services.gateway import gateway_service

router = APIRouter(tags=["gateway"], dependencies=[Depends(require_bearer_token)])


@router.post("/v1/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    result = await gateway_service.handle_chat(db, request)
    for name, value in result.headers.items():
        response.headers[name] = value
    return result.response


@router.get("/v1/models", response_model=ModelsResponse)
def list_models(db: Session = Depends(get_db)):
    return ModelsResponse(
        data=[ModelDescriptor(id=model_id) for model_id in gateway_service.list_models(db)],
    )

