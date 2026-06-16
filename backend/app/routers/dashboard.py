from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import Ticket, User
from app.schemas.common import ApiResponse
from app.services.ticket_service import ensure_support

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/metrics", response_model=ApiResponse[dict])
def metrics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_support(current_user)
    today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)
    total_open = db.scalar(select(func.count(Ticket.id)).where(Ticket.status == "open")) or 0
    in_progress = db.scalar(select(func.count(Ticket.id)).where(Ticket.status == "in_progress")) or 0
    overdue = db.scalar(select(func.count(Ticket.id)).where(Ticket.sla_deadline < datetime.now(timezone.utc), Ticket.status.notin_(["resolved", "cancelled"]))) or 0
    resolved_today = db.scalar(select(func.count(Ticket.id)).where(Ticket.status == "resolved", Ticket.resolved_at >= today_start)) or 0
    by_status = dict(db.execute(select(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status)).all())
    recent = db.scalars(select(Ticket).order_by(Ticket.created_at.desc()).limit(5)).all()
    return {
        "data": {
            "total_open": total_open,
            "in_progress": in_progress,
            "overdue": overdue,
            "resolved_today": resolved_today,
            "by_status": by_status,
            "recent": [{"id": str(t.id), "code": t.code, "title": t.title, "status": t.status, "priority": t.priority} for t in recent],
        },
        "message": "OK",
    }
