from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.user import UserRead


class TicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=5)
    category: str
    priority: str


class TicketStatusUpdate(BaseModel):
    status: str


class TicketPriorityUpdate(BaseModel):
    priority: str


class TicketAssignUpdate(BaseModel):
    assignee_id: UUID | None


class CommentCreate(BaseModel):
    content: str = Field(min_length=2)
    is_internal: bool = False


class CommentRead(BaseModel):
    id: UUID
    content: str
    is_internal: bool
    created_at: datetime
    author: UserRead

    model_config = {"from_attributes": True}


class HistoryRead(BaseModel):
    id: UUID
    field_changed: str
    old_value: str | None
    new_value: str | None
    description: str
    created_at: datetime
    changed_by: UserRead

    model_config = {"from_attributes": True}


class TicketRead(BaseModel):
    id: UUID
    code: str
    title: str
    description: str
    status: str
    priority: str
    category: str
    requester: UserRead
    assignee: UserRead | None
    sla_deadline: datetime
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    is_overdue: bool

    model_config = {"from_attributes": True}
