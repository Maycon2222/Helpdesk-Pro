from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import Comment, Ticket, TicketHistory, User
from app.schemas.common import ApiResponse
from app.schemas.ticket import CommentCreate, CommentRead, HistoryRead, TicketAssignUpdate, TicketCreate, TicketPriorityUpdate, TicketRead, TicketStatusUpdate
from app.services.ticket_service import PRIORITY_LABELS, SLA_HOURS, STATUS_LABELS, VALID_CATEGORIES, add_history, ensure_support, get_ticket_for_user, is_overdue, next_ticket_code

router = APIRouter(prefix="/tickets", tags=["tickets"])


def serialize_ticket(ticket: Ticket) -> TicketRead:
    return TicketRead.model_validate({**ticket.__dict__, "requester": ticket.requester, "assignee": ticket.assignee, "is_overdue": is_overdue(ticket)})


@router.get("", response_model=ApiResponse[dict])
def list_tickets(
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    assignee_id: UUID | None = None,
    search: str | None = None,
    overdue: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = []
    if current_user.role == "requester":
        filters.append(Ticket.requester_id == current_user.id)
    if status:
        filters.append(Ticket.status == status)
    if priority:
        filters.append(Ticket.priority == priority)
    if category:
        filters.append(Ticket.category == category)
    if assignee_id:
        filters.append(Ticket.assignee_id == assignee_id)
    if search:
        pattern = f"%{search}%"
        filters.append(or_(Ticket.code.ilike(pattern), Ticket.title.ilike(pattern)))
    if overdue is True:
        filters.append(and_(Ticket.sla_deadline < datetime.now(timezone.utc), Ticket.status.notin_(["resolved", "cancelled"])))

    total = db.scalar(select(func.count(Ticket.id)).where(*filters)) or 0
    tickets = db.scalars(
        select(Ticket)
        .options(joinedload(Ticket.requester), joinedload(Ticket.assignee))
        .where(*filters)
        .order_by(Ticket.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {"data": {"items": [serialize_ticket(ticket) for ticket in tickets], "total": total, "page": page, "page_size": page_size}, "message": "OK"}


@router.post("", response_model=ApiResponse[TicketRead])
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.priority not in SLA_HOURS:
        raise HTTPException(status_code=400, detail="Prioridade inválida")
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoria inválida")
    now = datetime.now(timezone.utc)
    ticket = Ticket(
        code=next_ticket_code(db),
        title=payload.title,
        description=payload.description,
        category=payload.category,
        priority=payload.priority,
        status="open",
        requester=current_user,
        sla_deadline=now + timedelta(hours=SLA_HOURS[payload.priority]),
        created_at=now,
    )
    db.add(ticket)
    db.flush()
    add_history(db, ticket, current_user, "creation", None, ticket.code, f"Chamado {ticket.code} criado")
    db.commit()
    ticket = get_ticket_for_user(db, ticket.id, current_user)
    return {"data": serialize_ticket(ticket), "message": "Chamado criado"}


@router.get("/{ticket_id}", response_model=ApiResponse[TicketRead])
def get_ticket(ticket_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = get_ticket_for_user(db, ticket_id, current_user)
    return {"data": serialize_ticket(ticket), "message": "OK"}


@router.patch("/{ticket_id}/status", response_model=ApiResponse[TicketRead])
def update_status(ticket_id: UUID, payload: TicketStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_support(current_user)
    if payload.status not in STATUS_LABELS:
        raise HTTPException(status_code=400, detail="Status inválido")
    ticket = get_ticket_for_user(db, ticket_id, current_user)
    old = ticket.status
    ticket.status = payload.status
    ticket.resolved_at = datetime.now(timezone.utc) if payload.status == "resolved" else None
    add_history(db, ticket, current_user, "status", old, payload.status, f"Status alterado de '{STATUS_LABELS.get(old, old)}' para '{STATUS_LABELS.get(payload.status, payload.status)}'")
    db.commit()
    ticket = get_ticket_for_user(db, ticket_id, current_user)
    return {"data": serialize_ticket(ticket), "message": "Status atualizado"}


@router.patch("/{ticket_id}/priority", response_model=ApiResponse[TicketRead])
def update_priority(ticket_id: UUID, payload: TicketPriorityUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_support(current_user)
    if payload.priority not in PRIORITY_LABELS:
        raise HTTPException(status_code=400, detail="Prioridade inválida")
    ticket = get_ticket_for_user(db, ticket_id, current_user)
    old = ticket.priority
    ticket.priority = payload.priority
    add_history(db, ticket, current_user, "priority", old, payload.priority, f"Prioridade alterada de '{PRIORITY_LABELS.get(old, old)}' para '{PRIORITY_LABELS.get(payload.priority, payload.priority)}'")
    db.commit()
    ticket = get_ticket_for_user(db, ticket_id, current_user)
    return {"data": serialize_ticket(ticket), "message": "Prioridade atualizada"}


@router.patch("/{ticket_id}/assign", response_model=ApiResponse[TicketRead])
def assign(ticket_id: UUID, payload: TicketAssignUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_support(current_user)
    ticket = get_ticket_for_user(db, ticket_id, current_user)
    old = str(ticket.assignee_id) if ticket.assignee_id else None
    ticket.assignee_id = payload.assignee_id
    add_history(db, ticket, current_user, "assignee", old, str(payload.assignee_id) if payload.assignee_id else None, "Responsável do chamado atualizado")
    db.commit()
    ticket = get_ticket_for_user(db, ticket_id, current_user)
    return {"data": serialize_ticket(ticket), "message": "Responsável atualizado"}


@router.get("/{ticket_id}/comments", response_model=ApiResponse[list[CommentRead]])
def list_comments(ticket_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_ticket_for_user(db, ticket_id, current_user)
    query = select(Comment).options(joinedload(Comment.author)).where(Comment.ticket_id == ticket_id)
    if current_user.role == "requester":
        query = query.where(Comment.is_internal.is_(False))
    comments = db.scalars(query.order_by(Comment.created_at.asc())).all()
    return {"data": comments, "message": "OK"}


@router.post("/{ticket_id}/comments", response_model=ApiResponse[CommentRead])
def add_comment(ticket_id: UUID, payload: CommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = get_ticket_for_user(db, ticket_id, current_user)
    internal = payload.is_internal and current_user.role in {"admin", "attendant"}
    comment = Comment(ticket=ticket, author=current_user, content=payload.content, is_internal=internal)
    db.add(comment)
    db.flush()
    add_history(db, ticket, current_user, "comment", None, str(comment.id), "Comentário adicionado ao chamado")
    db.commit()
    db.refresh(comment)
    return {"data": comment, "message": "Comentário adicionado"}


@router.get("/{ticket_id}/history", response_model=ApiResponse[list[HistoryRead]])
def list_history(ticket_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_ticket_for_user(db, ticket_id, current_user)
    history = db.scalars(
        select(TicketHistory)
        .options(joinedload(TicketHistory.changed_by))
        .where(TicketHistory.ticket_id == ticket_id)
        .order_by(TicketHistory.created_at.asc())
    ).all()
    return {"data": history, "message": "OK"}
