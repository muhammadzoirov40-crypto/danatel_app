"""🔐 Боргирии APK-и AutoDonat — ТАНҲО барои админ.

Талаби соҳиб (08.11.2026): «автоматики чизҳои зарурӣ мон» — токени
WEBHOOK_SECRET_TOKEN дар дохили APK ҷойгир аст → бояд файли APK аз
дастрасии умумӣ баста шавад (вагарна ҳама метавонад токенро бигирад
 ва фармоишҳоро бе пардохт «пардохтшуда» эълон кунад).

  · /AutoDonat-v1.0-debug.apk (статикӣ) → nginx =403 + SPA-fallback =403;
  · /api/apk → танҳо админ (Bearer JWT + is_admin) → файли ҳамон dist.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.models import User
from app.security import require_admin

router = APIRouter(prefix="/api", tags=["apk"])

APK_NAME = "AutoDonat-v1.0-debug.apk"


def apk_file_path() -> str:
    """Масири файли APK: аввал AppConfig APK_FILE, вагарна frontend/dist."""
    env = os.getenv("APK_FILE")
    if env:
        return env
    # __file__ = backend/app/routers/apk.py → 4 сатр боло = рути лоиҳа
    root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    return os.path.join(root, "frontend", "dist", APK_NAME)


@router.get("/apk", include_in_schema=False)
def download_apk(admin: User = Depends(require_admin)):  # noqa: ARG001
    """Боргирӣ бо токени админ (401 бе токен, 403 барои корбари оддӣ)."""
    path = apk_file_path()
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="APK ёфт нашуд")
    return FileResponse(
        path,
        media_type="application/vnd.android.package-archive",
        filename=APK_NAME,
        headers={"Cache-Control": "private, no-store"},
    )
