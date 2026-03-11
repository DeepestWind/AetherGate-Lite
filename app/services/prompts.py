from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.prompt import PromptTemplate
from app.repositories.prompts import PromptRepository
from app.schemas.chat import ChatMessage
from app.services.prompt_utils import safe_format


class PromptService:
    def __init__(self):
        self.repository = PromptRepository()

    def resolve(self, db: Session, prompt_id: str | None) -> PromptTemplate | None:
        if not prompt_id:
            return None
        return self.repository.get_by_prompt_id(db, prompt_id)

    def render(self, prompt_template: PromptTemplate, variables: dict) -> str:
        expected = set(prompt_template.variables or [])
        missing = [name for name in expected if name not in variables]
        if missing:
            raise ValueError(f"Missing prompt variables: {', '.join(sorted(missing))}")
        try:
            return safe_format(prompt_template.content, variables)
        except KeyError as exc:
            raise ValueError(f"Missing prompt variables: {exc.args[0]}") from exc

    def apply_template(
        self,
        db: Session,
        messages: list[ChatMessage],
        prompt_id: str | None,
        variables: dict,
    ) -> tuple[list[ChatMessage], PromptTemplate | None]:
        prompt_template = self.resolve(db, prompt_id)
        if not prompt_template:
            return messages, None
        if not prompt_template.is_active:
            raise ValueError(f"Prompt template '{prompt_template.prompt_id}' is inactive.")

        rendered = self.render(prompt_template, variables)
        updated = list(messages)
        system_message = ChatMessage(role="system", content=rendered)
        if updated and updated[0].role == "system":
            updated[0] = system_message
        else:
            updated.insert(0, system_message)
        prompt_template.use_count += 1
        db.add(prompt_template)
        db.commit()
        return updated, prompt_template
