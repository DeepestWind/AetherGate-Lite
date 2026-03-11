from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.prompt import PromptTemplate


class PromptRepository:
    def list(self, db: Session) -> Sequence[PromptTemplate]:
        stmt = select(PromptTemplate).order_by(PromptTemplate.prompt_id.asc())
        return db.scalars(stmt).all()

    def get(self, db: Session, prompt_template_id: int) -> PromptTemplate | None:
        return db.get(PromptTemplate, prompt_template_id)

    def get_by_prompt_id(self, db: Session, prompt_id: str) -> PromptTemplate | None:
        stmt = select(PromptTemplate).where(PromptTemplate.prompt_id == prompt_id)
        return db.scalar(stmt)

    def save(self, db: Session, prompt_template: PromptTemplate) -> PromptTemplate:
        db.add(prompt_template)
        db.commit()
        db.refresh(prompt_template)
        return prompt_template

    def delete(self, db: Session, prompt_template: PromptTemplate) -> None:
        db.delete(prompt_template)
        db.commit()

