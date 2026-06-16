from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, verify_password
from app.models import User
from app.schemas.common import ApiResponse
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


@router.post("/login", response_model=ApiResponse[LoginResponse])
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")
    token = create_access_token(str(user.id), user.role)
    return {"data": {"access_token": token, "user": user}, "message": "Login realizado"}


@router.get("/me", response_model=ApiResponse[UserRead])
def me(current_user: User = Depends(get_current_user)):
    return {"data": current_user, "message": "OK"}
