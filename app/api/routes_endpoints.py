from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import require_bearer_token
from app.core.security import encrypt_secret, mask_secret, decrypt_secret
from app.db.session import get_db
from app.models.endpoint import ModelEndpoint
from app.repositories.endpoints import EndpointRepository
from app.schemas.endpoints import (
    EndpointCreate,
    EndpointResponse,
    EndpointToggleRequest,
    EndpointUpdate,
    EndpointValidationResponse,
)
from app.services.registry import ProviderRegistry

router = APIRouter(
    prefix="/api/endpoints",
    tags=["endpoints"],
    dependencies=[Depends(require_bearer_token)],
)

repository = EndpointRepository()
providers = ProviderRegistry()


def _to_response(endpoint: ModelEndpoint) -> EndpointResponse:
    response = EndpointResponse.model_validate(endpoint)
    return response.model_copy(update={"masked_key": mask_secret(decrypt_secret(endpoint.encrypted_key))})


@router.get("", response_model=list[EndpointResponse])
def list_endpoints(db: Session = Depends(get_db)):
    return [_to_response(item) for item in repository.list(db)]


@router.post("", response_model=EndpointResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(payload: EndpointCreate, db: Session = Depends(get_db)):
    if repository.get_by_name(db, payload.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Endpoint name already exists.")
    try:
        provider = providers.get(payload.provider_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    endpoint = ModelEndpoint(
        name=payload.name,
        provider_type=provider.provider_type,
        base_url=payload.base_url,
        encrypted_key=encrypt_secret(payload.api_key) if payload.api_key else None,
        model_name=payload.model_name,
        logical_model=payload.logical_model,
        priority=payload.priority,
        weight=payload.weight,
        input_cost_per_1k=payload.input_cost_per_1k,
        output_cost_per_1k=payload.output_cost_per_1k,
        quality_score=payload.quality_score,
        is_enabled=payload.is_enabled,
        remark=payload.remark,
    )
    return _to_response(repository.save(db, endpoint))


@router.get("/{endpoint_id}", response_model=EndpointResponse)
def get_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    endpoint = repository.get(db, endpoint_id)
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found.")
    return _to_response(endpoint)


@router.put("/{endpoint_id}", response_model=EndpointResponse)
def update_endpoint(endpoint_id: int, payload: EndpointUpdate, db: Session = Depends(get_db)):
    endpoint = repository.get(db, endpoint_id)
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found.")
    if payload.provider_type is not None:
        try:
            providers.get(payload.provider_type)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        if field_name == "api_key":
            endpoint.encrypted_key = encrypt_secret(value) if value else None
        else:
            setattr(endpoint, field_name, value)
    return _to_response(repository.save(db, endpoint))


@router.delete("/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    endpoint = repository.get(db, endpoint_id)
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found.")
    repository.delete(db, endpoint)


@router.put("/{endpoint_id}/enabled", response_model=EndpointResponse)
def set_endpoint_enabled(
    endpoint_id: int,
    payload: EndpointToggleRequest,
    db: Session = Depends(get_db),
):
    endpoint = repository.get(db, endpoint_id)
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found.")
    endpoint.is_enabled = payload.is_enabled
    return _to_response(repository.save(db, endpoint))


@router.post("/{endpoint_id}/validate", response_model=EndpointValidationResponse)
async def validate_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    endpoint = repository.get(db, endpoint_id)
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found.")
    provider = providers.get(endpoint.provider_type)
    is_valid, detail = await provider.validate_endpoint(endpoint)
    endpoint.is_valid = is_valid
    endpoint.last_validated_at = datetime.now(timezone.utc)
    repository.save(db, endpoint)
    return EndpointValidationResponse(
        endpoint_id=endpoint.id,
        is_valid=is_valid,
        detail=detail,
        last_validated_at=endpoint.last_validated_at,
    )
