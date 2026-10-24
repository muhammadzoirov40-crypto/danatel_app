"""🔍 Логини Player ID / ник — прокси ба APIҳои берунӣ (мисли бот)."""
import httpx
from fastapi import APIRouter, Query

from app.schemas import PlayerLookupResponse

router = APIRouter(prefix="/api/games", tags=["Player Lookup"])

# Таймаутҳои якхела бо бот
_API_TIMEOUT = httpx.Timeout(12.0, connect=5.0)
_LOOKUP_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/141.0.0.0 Safari/537.36"
)
_APP_UA = "DanatelShop/1.0 (+https://danatel.tj)"

# Маппинг slug -> номи API
GAME_API_MAP = {
    "free-fire": "ff",
    "pubg-mobile": "pubg",
    "mobile-legends": "mlbb",
    "blood-strike": "bloodstrike",
    "arena-breakout": "arenabreakout",
    "arena-breakout-infinite": "arenabreakout",
    "honor-of-kings": "hok",
    "marvel-rivals": "marvel",
}


def _extract_nickname(data: dict) -> str:
    """Никномро аз навишҳои гуногун гирифта."""
    if not isinstance(data, dict):
        return ""
    for key in (
        "nickname",
        "name",
        "player_name",
        "playerName",
        "AccountName",
        "account_name",
    ):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    for nested_key in ("basicInfo", "basicinfo", "BasicInfo", "data", "player", "account"):
        nested = data.get(nested_key)
        if isinstance(nested, dict):
            found = _extract_nickname(nested)
            if found:
                return found
    return ""


def _extract_region(data: dict) -> str:
    """Регионро гирифта."""
    if not isinstance(data, dict):
        return ""
    for key in ("region", "server", "Region", "Server"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().upper()
    for nested_key in ("basicInfo", "basicinfo", "BasicInfo", "data"):
        nested = data.get(nested_key)
        if isinstance(nested, dict):
            found = _extract_region(nested)
            if found:
                return found
    return ""


async def _lookup_free_fire(uid: str) -> PlayerLookupResponse:
    """Логини Free Fire аз epep-api.vercel.app."""
    regions = ("ind", "sg", "br", "ru", "id", "tw", "us", "vn", "th", "me", "pk")

    async with httpx.AsyncClient(timeout=_API_TIMEOUT, headers={"User-Agent": _LOOKUP_UA}) as client:
        for region in regions:
            try:
                resp = await client.get(
                    "https://epep-api.vercel.app/api/freefire/player/profile",
                    params={
                        "server": region,
                        "uid": uid,
                        "need_gallery_info": "false",
                        "call_sign_src": "7",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and data.get("status") != "error":
                        nickname = _extract_nickname(data)
                        game_region = _extract_region(data) or region.upper()
                        if nickname:
                            return PlayerLookupResponse(
                                found=True,
                                uid=uid,
                                game="Free Fire",
                                nickname=nickname,
                                region=game_region,
                            )
            except Exception:
                continue

    return PlayerLookupResponse(
        found=False,
        uid=uid,
        game="Free Fire",
        message="Ник ёфт нашуд",
    )


async def _lookup_wzapi(uid: str, game: str) -> PlayerLookupResponse:
    """Логини бозиҳои дигар аз wzapiinfo.vercel.app."""
    # wzapiinfo фармоишҳои гуногунро дорад, мо вариантҳоро месанҷем
    endpoints = [
        f"https://wzapiinfo.vercel.app/api/{game}/player/{uid}",
        f"https://wzapiinfo.vercel.app/get?uid={uid}&game={game}",
    ]

    async with httpx.AsyncClient(timeout=_API_TIMEOUT, headers={"User-Agent": _LOOKUP_UA}) as client:
        for url in endpoints:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    nickname = _extract_nickname(data)
                    region = _extract_region(data)
                    if nickname:
                        return PlayerLookupResponse(
                            found=True,
                            uid=uid,
                            game=game,
                            nickname=nickname,
                            region=region,
                        )
            except Exception:
                continue

    return PlayerLookupResponse(
        found=False,
        uid=uid,
        game=game,
        message="Ник ёфт нашуд",
    )


async def _lookup_fireloot(uid: str, game: str) -> PlayerLookupResponse:
    """Валидатсия аз FireLoot (агар калид бошад)."""
    # FireLoot бояд калид дошта бошад, агар не ҳамакор бош
    return PlayerLookupResponse(
        found=False,
        uid=uid,
        game=game,
        message="FireLoot лозим аст",
    )


@router.get("/{slug}/lookup", response_model=PlayerLookupResponse)
async def lookup_player(
    slug: str,
    uid: str = Query(..., min_length=3, max_length=64, description="Player ID / UID"),
):
    """
    Логини никном ба Player ID.
    - Free Fire: epep-api (multi-region)
    - ПУБГ/MLBB/дигар: wzapiinfo
    """
    # Валидаияи асосӣ
    if not uid.isdigit() or len(uid) < 8:
        return PlayerLookupResponse(
            found=False,
            uid=uid,
            game=slug,
            message="ID нодуруст (факъат рақам, мин 8 рақам)",
        )

    game_key = GAME_API_MAP.get(slug, slug)

    # Free Fire -> epep-api (натиҷаи беҳтарин)
    if slug == "free-fire":
        return await _lookup_free_fire(uid)

    # ПУБГ Mobile -> wzapiinfo
    if slug in ("pubg-mobile", "mobile-legends", "blood-strike"):
        return await _lookup_wzapi(uid, game_key)

    # Бозӣҳои дигар -> FireLoot / wzapiinfo
    result = await _lookup_wzapi(uid, game_key)
    if result.found:
        return result

    # Fallback
    return await _lookup_fireloot(uid, game_key)