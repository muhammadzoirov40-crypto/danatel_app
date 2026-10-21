"""Роутери вуруд ва эътирофи админ."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, Token, UserOut
from app.security import create_access_token, get_current_user, verify_password
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Вуруд барои админ бо телефон + парол."""
    phone = payload.phone.strip().replace(" ", "").replace("+", "")

    # Вуруди админ аз .env
    if phone == settings.ADMIN_PHONE.replace("+", "") and payload.password == settings.ADMIN_PASSWORD:
        user = db.scalar(select(User).where(User.is_admin.is_(True)).limit(1))
        if user is None:
            user = User(full_name="Admin", language="tj", is_admin=True)
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token({"sub": str(user.id), "admin": True})
        return Token(access_token=token, is_admin=True)

    # Вуруди оддӣ (дар оянда илова карда мешавад)
    raise HTTPException(status_code=401, detail="Номи корбар ё парол нодуруст")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
