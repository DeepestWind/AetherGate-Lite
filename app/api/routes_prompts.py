from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import require_bearer_token
from app.db.session import get_db
from app.models.prompt import PromptTemplate
from app.repositories.prompts import PromptRepository
from app.schemas.prompts import (
    PromptCreate,
    PromptPreviewRequest,
    PromptPreviewResponse,
    PromptResponse,
    PromptUpdate,
)
from app.services.prompts import PromptService

router = APIRouter(
    prefix="/api/prompts",
    tags=["prompts"],
    dependencies=[Depends(require_bearer_token)],
)

repository = PromptRepository()
prompt_service = PromptService()


@router.get("", response_model=list[PromptResponse])
def list_prompts(db: Session = Depends(get_db)):
    return repository.list(db)


@router.post("", response_model=PromptResponse, status_code=status.HTTP_201_CREATED)
def create_prompt(payload: PromptCreate, db: Session = Depends(get_db)):
    if repository.get_by_prompt_id(db, payload.prompt_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Prompt ID already exists.")
    prompt = PromptTemplate(**payload.model_dump())
    return repository.save(db, prompt)


@router.get("/{prompt_template_id}", response_model=PromptResponse)
def get_prompt(prompt_template_id: int, db: Session = Depends(get_db)):
    prompt = repository.get(db, prompt_template_id)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found.")
    return prompt


@router.put("/{prompt_template_id}", response_model=PromptResponse)
def update_prompt(prompt_template_id: int, payload: PromptUpdate, db: Session = Depends(get_db)):
    prompt = repository.get(db, prompt_template_id)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found.")
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(prompt, field_name, value)
    return repository.save(db, prompt)


@router.delete("/{prompt_template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt(prompt_template_id: int, db: Session = Depends(get_db)):
    prompt = repository.get(db, prompt_template_id)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found.")
    repository.delete(db, prompt)


@router.post("/{prompt_template_id}/preview", response_model=PromptPreviewResponse)
def preview_prompt(
    prompt_template_id: int,
    payload: PromptPreviewRequest,
    db: Session = Depends(get_db),
):
    prompt = repository.get(db, prompt_template_id)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found.")
    try:
        rendered = prompt_service.render(prompt, payload.variables)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PromptPreviewResponse(prompt_id=prompt.prompt_id, rendered=rendered)
