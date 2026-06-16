from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import hash_password
from app.models import User
from app.schemas.common import ApiResponse
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.ticket_service import ensure_admin

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=ApiResponse[list[UserRead]])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_admin(current_user)
    users = db.scalars(select(User).order_by(User.name)).all()
    return {"data": users, "message": "OK"}


@router.post("", response_model=ApiResponse[UserRead])
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_admin(current_user)
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    user = User(name=payload.name, email=payload.email, role=payload.role, is_active=payload.is_active, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"data": user, "message": "Usuário criado"}


@router.get("/{user_id}", response_model=ApiResponse[UserRead])
def get_user(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_admin(current_user)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"data": user, "message": "OK"}


@router.patch("/{user_id}", response_model=ApiResponse[UserRead])
def update_user(user_id: UUID, payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_admin(current_user)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    for field in ["name", "email", "role", "is_active"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(user, field, value)
    if payload.password:
        user.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(user)
    return {"data": user, "message": "Usuário atualizado"}


@router.patch("/{user_id}/toggle-active", response_model=ApiResponse[UserRead])
def toggle_active(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_admin(current_user)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return {"data": user, "message": "Status atualizado"}
