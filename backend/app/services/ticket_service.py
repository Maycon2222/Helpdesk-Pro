from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Comment, Ticket, TicketHistory, User

SLA_HOURS = {"low": 120, "medium": 72, "high": 24, "urgent": 4}
STATUS_LABELS = {
    "open": "Aberto",
    "in_progress": "Em atendimento",
    "waiting": "Aguardando resposta",
    "resolved": "Resolvido",
    "cancelled": "Cancelado",
}
PRIORITY_LABELS = {"low": "Baixa", "medium": "Media", "high": "Alta", "urgent": "Urgente"}
VALID_CATEGORIES = ["Infraestrutura", "Software", "Hardware", "Acesso e permissões", "Solicitação de serviço", "Outros"]


def is_overdue(ticket: Ticket) -> bool:
    return ticket.status not in {"resolved", "cancelled"} and datetime.now(timezone.utc) > ticket.sla_deadline


def next_ticket_code(db: Session) -> str:
    count = db.scalar(select(func.count(Ticket.id))) or 0
    return f"CHM-{count + 1:06d}"


def add_history(db: Session, ticket: Ticket, user: User, field: str, old: str | None, new: str | None, description: str) -> None:
    db.add(TicketHistory(ticket=ticket, changed_by=user, field_changed=field, old_value=old, new_value=new, description=description))


def get_ticket_for_user(db: Session, ticket_id: UUID, current_user: User) -> Ticket:
    ticket = db.scalar(
        select(Ticket)
        .options(joinedload(Ticket.requester), joinedload(Ticket.assignee))
        .where(Ticket.id == ticket_id)
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chamado não encontrado")
    if current_user.role == "requester" and ticket.requester_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    return ticket


def ensure_support(user: User) -> None:
    if user.role not in {"admin", "attendant"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas atendentes ou admins podem executar esta ação")


def ensure_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas admins podem executar esta ação")
