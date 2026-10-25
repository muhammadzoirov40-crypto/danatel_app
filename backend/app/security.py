"""Амният: ҳоссҳои парол (Argon2id) ва токенҳои JWT.

🔒 Қоидаҳои амнияти ин файл:
  • Паролҳо ТАНҲО ҳосс мешавад — Argon2id (bcrypt барои кӯҳнаҳо).
  • Токен бо `HS256` имзо мешавад; алгоритми имзо АЗ .ENV ҚАБУЛ НАМЕШАВАД.
  • Ҳар токен `jti` дорад → Logout онро бекор мекунад (ревокатсия).
  • Ҳеҷ гоҳ парол, ҳосс ё токен дар лог ё паёми хато навишта намешавад.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import RevokedToken, User

# 🔒 Танҳо ин алгоритмҳо қабул мешаванд. `none`, HS384, RS256… рад мешавад.
#    Сабаб: агар алгоритм аз .env ояд, танзими нодуруст → токени қалбакӣ.
ALLOWED_JWT_ALGORITHMS: tuple[str, ...] = ("HS256",)
TOKEN_ISSUER = "danatel.tj"

# Argon2id (низо) бо bcrypt барои мигратсияи корбарони кӯҳна.
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto",          # bcrypt → беҳтарин (argon2) дар вуруди навбатӣ
    argon2__type="id",
    argon2__time_cost=2,
    argon2__memory_cost=65536,  # 64 MB — мӯътадил барои сервер
    argon2__parallelism=1,
    bcrypt__rounds=12,
)

bearer_scheme = HTTPBearer(auto_error=False)


# =====================================================================
# 🧂 ПАРОЛҲО
# =====================================================================
def hash_password(password: str) -> str:
    """Ҳосси парол (Argon2id). Ҳеҷ гоҳ пароли одиро нигоҳ накунед."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str | None) -> bool:
    """Санҷиши парол. Ҳосси вайрон → false (бе ифшои сабаб)."""
    if not hashed:
        return False
    try:
        return pwd_context.verify(plain or "", hashed)
    except (ValueError, TypeError, Exception):  # noqa: BLE001
        # bcrypt/argon2 метавонад ҳосси вайронро истисно партояд
        return False


def needs_rehash(hashed: str | None) -> bool:
    """Оё ҳосс бояд ба Алгоритми навтарин (Argon2id) навсозӣ шавад?"""
    if not hashed:
        return False
    try:
        return bool(pwd_context.needs_update(hashed))
    except Exception:  # noqa: BLE001
        return False


# =====================================================================
# 🎫 ТОКЕНҲО (JWT)
# =====================================================================
def create_access_token(data: dict, expires_minutes: int | None = None) -> str:
    """Сохтани токен бо `iat`, `exp`, `jti` ва `iss`."""
    now = datetime.now(timezone.utc)
    minutes = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    to_encode = dict(data)
    to_encode.update(
        {
            "iat": int(now.timestamp()),
            "exp": now + timedelta(minutes=minutes),
            "jti": uuid.uuid4().hex,
            "iss": TOKEN_ISSUER,
        }
    )
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str, db: Session) -> dict:
    """Декод кардани токен бо санҷиши қатъӣ.

    • Алгоритм танҳо HS256
    • `exp` ва `iss` санҷида мешавад
    • `jti`-и бекоршуда (Logout / ивазкунии парол) рад мешавад

    Ҳамаи хатоҳо → JWTError (мо танҳо «нодуруст» мегӯем).
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=list(ALLOWED_JWT_ALGORITHMS),
            issuer=TOKEN_ISSUER,
            options={"require": ["exp", "sub", "iat"]},
        )
    except JWTError as exc:  # noqa: PERF203
        raise JWTError(str(exc)) from exc

    jti = payload.get("jti")
    if jti and _is_token_revoked(db, str(jti)):
        raise JWTError("token revoked")
    return payload


# =====================================================================
# 🚫 РЕВОКАТСИЯИ ТОКЕН (Logout)
# =====================================================================
def revoke_token(db: Session, jti: str | None, user_id: int | None, exp: object = None) -> None:
    """Бекор кардани як токен (Logout)."""
    if not jti:
        return
    if db.scalar(select(RevokedToken.id).where(RevokedToken.jti == jti)) is not None:
        return
    expires_at = _naive_utc(
        _as_datetime(exp) or (datetime.now(timezone.utc) + timedelta(days=2))
    )
    db.add(
        RevokedToken(
            jti=jti,
            user_id=int(user_id) if user_id else None,
            expires_at=expires_at,
            reason="logout",
        )
    )
    db.commit()
    _cleanup_revoked(db)


def bump_token_version(db: Session, user: User) -> None:
    """🔐 Беэътибор кардани ҲАМАИ токенҳои корбар.

    Ҳангоми ивазкунии парол истифода мешавад. Токенҳои нав бо `tv`-и нав
    бароварда мешаванд → токени ҷорӣ (сеанс) ҳам идома меёбад, вале
    ҳар токени пешина дарҳол кор намекунад. (Бе race-и вақт.)
    """
    user.token_version = int(user.token_version or 0) + 1
    db.commit()


def _is_token_revoked(db: Session, jti: str) -> bool:
    """Оё ин токен (jti) бекор шудааст?"""
    return (
        db.scalar(select(RevokedToken.id).where(RevokedToken.jti == jti).limit(1))
        is not None
    )


def _cleanup_revoked(db: Session) -> None:
    """Нест кардани сабтҳои муҳлаташон гузашта (тозакунӣ)."""
    try:
        db.execute(
            delete(RevokedToken).where(
                RevokedToken.expires_at < _naive_utc(datetime.now(timezone.utc))
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def _naive_utc(dt: datetime) -> datetime:
    """Ҷадвалҳо вақтро бе minytzone нигоҳ медоранд → UTC-и оддӣ."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _as_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    return None


# =====================================================================
# 👤 КОРБАРИ ҶОРИИ
# =====================================================================
def _token_matches_user(payload: dict, user: User) -> bool:
    """🔐 Санҷиши насби токен (`tv` == `users.token_version`).

    Ҳангоми ивазкунии парол `token_version` зиёд мешавад → ҳамаи
    токенҳои пешина дарҳол беэътибор. Токени нав ҳамон `tv`-ро дорад.
    Токени пешинаи бе `tv` (пеш аз ин навсозӣ) то муҳлаташ кор мекунад.
    """
    tv = payload.get("tv")
    if tv is None:
        return True
    try:
        return int(tv) == int(user.token_version or 0)
    except (TypeError, ValueError):
        return False


def _decode_user(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
) -> User | None:
    """Кӯшиши гирифтани корбар аз токен. Агар нодуруст бошад → None."""
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials, db)
        user_id = payload.get("sub")
        if user_id is None:
            return None
        user = db.get(User, int(user_id))
        if user is None or not _token_matches_user(payload, user):
            return None
        return user
    except (JWTError, ValueError, TypeError):
        return None


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """
    🔓 Корбари ҷорӣ АГАР токен дуруст бошад, вагарна None.

    Барои endpoints-ҳое, ки ҳам барои мизоҷони бе вуруд ва ҳам
    барои корбарони вурудкарда кор мекунанд (масалан: фармоиш).
    """
    return _decode_user(credentials, db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Корбари ҷорӣ аз токен (ё токени нодуруст/бекоршуда)."""
    payload = get_token_payload(credentials, db)
    user = _payload_user(payload, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен нодуруст ё мӯҳлаташ гузаштааст",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_token_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """Ҳамон токени ҷорӣ ҳамчун payload (барои Logout/ревокатсия).

    Токени нодуруст, муҳлаташ гузашта ё бекоршуда → 401.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Токен нодуруст ё мӯҳлаташ гузаштааст",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        return decode_token(credentials.credentials, db)
    except JWTError:
        raise unauthorized from None


def _payload_user(payload: dict, db: Session) -> User | None:
    try:
        user_id = int(payload.get("sub"))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    user = db.get(User, user_id)
    if user is None or not _token_matches_user(payload, user):
        return None
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Танҳо барои админ."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Иҷозати админ лозим аст",
        )
    return user
