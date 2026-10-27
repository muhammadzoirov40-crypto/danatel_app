"""
🔍 Логини Player ID / ник — ҳамон коди боти Telegram.

Манбаъҳо (тартиби мувофиқи бот):
  1) 🔥 FireLoot partner API  — манбаи асосӣ (калид лозим)
     POST /validate {sku, uid} → {valid, player_name, name_checked, region}
  2) epep-api.vercel.app     — фолбэк барои Free Fire
  3) wzapiinfo.vercel.app    — фолбэк барои бозиҳои дигар
"""
from __future__ import annotations

import logging
import time

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.schemas import PlayerLookupResponse

logger = logging.getLogger("lookup")

router = APIRouter(prefix="/api/games", tags=["Player Lookup"])

# Таймаутҳои якхела бо бот
_API_TIMEOUT = httpx.Timeout(15.0, connect=5.0)
_VALIDATE_TIMEOUT = httpx.Timeout(20.0, connect=5.0)
_LOOKUP_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/141.0.0.0 Safari/537.36"
)
_APP_UA = "DanatelShop/1.0 (+https://danatel.tj)"

# 📦 SKUҳои эҳтимолӣ барои ҳар бозӣ (аз рӯи префикси бот)
_GAME_SKU_PREFIXES: dict[str, tuple[str, ...]] = {
    "ff": ("diamonds_",),
    "pubg": ("pubg_",),
    "mlbb_ru": ("mlbb_",),
    "mlbb_cis": ("mlbbcis_",),
    "bloodstrike": ("bs_",),
    "arena": ("ab_",),
    "arena_infinite": ("abi_",),
    "hok": ("hok_",),
    "marvel": ("mr_",),
}

# 🔀 Ҳама префикси SKU-и бозӣ аз рӯи slug (MLBB = ду минтақа: mlbb_ + mlbbcis_)
#    FF = 11 минтақаи каталоги FireLoot: CIS бе префикс, боқия бо коди кишвар
SLUG_SKU_PREFIXES: dict[str, tuple[str, ...]] = {
    "free-fire": (
        "diamonds_",  # CIS (пешфарз)
        "bd_", "br_", "eu_", "id_", "latam_",
        "mena_", "pk_", "sg_", "tw_", "vn_",
        # CIS бе префикси кишвар: пропускҳо ва вучерҳо
        "levelpass_", "voucher_",
    ),
    "pubg-mobile": ("pubg_",),
    "mobile-legends": ("mlbb_", "mlbbcis_"),
    "blood-strike": ("bs_",),
    "arena-breakout": ("ab_",),
    "arena-breakout-infinite": ("abi_",),
    "honor-of-kings": ("hok_",),
    "marvel-rivals": ("mr_",),
}

# 🌍 Минтақаи пешфарз — ҳамон чизе, ки бот ҳамеша истифода мебурт
#    (FF → CIS, MLBB → Russia; боқияш дар UI интихоб мешавад)
DEFAULT_REGION: dict[str, str] = {
    "free-fire": "CIS",
    "mobile-legends": "MLBB RUSSIA",
}

# ✅ Категорияи бартарӣ (барои он ки SKU-и дуруст интихоб шавад)
#    Масалан: PUBG → `pubg_uc_60` (cat=uc), на `pubg_first_purchase` (cat=other)
_GAME_CATEGORY: dict[str, tuple[str, ...]] = {
    "ff": ("diamonds",),
    "pubg": ("uc", "wow"),
    "mlbb_ru": ("diamonds",),
    "mlbb_cis": ("diamonds",),
    "bloodstrike": ("gold",),
    "arena": ("bonds",),
    "arena_infinite": ("bonds",),
    "hok": ("tokens", "other"),
    "marvel": ("lattice",),
}

# 🗺️ Бозиҳое, ки Zone/Server ID талаб мекунанд (MLBB)
GAMES_NEED_ZONE = {"mobile-legends"}

# Фолбэк агар /products дастрас набошад (ҳамон бот)
FALLBACK_SKUS: dict[str, str] = {
    "ff": "diamonds_110",
    "pubg": "pubg_uc_60",
    "bloodstrike": "bs_gold_100",
    "mlbb_ru": "mlbb_diamonds_50",
    "arena": "ab_bonds_60",
    "arena_infinite": "abi_bonds_100",
    "hok": "hok_honor_point_value_pack",
    "marvel": "mr_lattice_600",
}

# slug → калиди бозӣ
GAME_KEY: dict[str, str] = {
    "free-fire": "ff",
    "pubg-mobile": "pubg",
    "mobile-legends": "mlbb_ru",
    "blood-strike": "bloodstrike",
    "arena-breakout": "arena",
    "arena-breakout-infinite": "arena_infinite",
    "honor-of-kings": "hok",
    "marvel-rivals": "marvel",
}

GAME_LABEL: dict[str, str] = {
    "free-fire": "Free Fire",
    "pubg-mobile": "PUBG Mobile",
    "mobile-legends": "Mobile Legends",
    "blood-strike": "Blood Strike",
    "arena-breakout": "Arena Breakout",
    "arena-breakout-infinite": "Arena Breakout: Infinite",
    "honor-of-kings": "Honor of Kings",
    "marvel-rivals": "Marvel Rivals",
}

PRODUCTS_TTL = 15 * 60  # ҳамон бот: 10-15 дақиқа, ҳаргиз зиёда аз 1 соат


# =====================================================================
# 🔥 FIRELOOT — манбаи асосӣ (аз коди бот)
# =====================================================================
class _FireLoot:
    """Тунукаи client-и FireLoot partner API."""

    def __init__(self) -> None:
        self.base = (settings.FIRELOOT_API_URL or "").rstrip("/")
        self.key = settings.FIRELOOT_API_KEY or ""
        self._products: list[dict] = []
        self._products_at: float = 0.0

    @property
    def configured(self) -> bool:
        return bool(self.base and self.key)

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.key}",
            "User-Agent": _APP_UA,
        }

    async def products(self) -> list[dict]:
        """Рӯйхати маҳсулотҳо (кэш 15 дақиқа)."""
        if time.time() - self._products_at < PRODUCTS_TTL and self._products:
            return self._products
        async with httpx.AsyncClient(timeout=_API_TIMEOUT) as client:
            resp = await client.get(f"{self.base}/products", headers=self._headers())
            resp.raise_for_status()
            data = resp.json()
        if isinstance(data, list):
            self._products = data
            self._products_at = time.time()
        return self._products

    async def balance(self) -> dict:
        """💰 Баланси ҳисоби FireLoot — воқеӣ аз API (бе кэш)."""
        async with httpx.AsyncClient(timeout=_API_TIMEOUT) as client:
            resp = await client.get(f"{self.base}/balance", headers=self._headers())
            resp.raise_for_status()
            data = resp.json()
        return data if isinstance(data, dict) else {}

    @staticmethod
    def _price_key(p: object):
        try:
            return float(p)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return 1e18

    def pick_sku(
        self,
        products: list[dict],
        game: str,
        region: str = "",
        prefixes: tuple[str, ...] | None = None,
    ) -> str | None:
        """Интихоби SKU — аввал минтақаи корбар, баъд категория/префикс, баъд фолбэк."""
        usable = [p for p in products if p.get("sku")]
        pre = tuple(prefixes) if prefixes else _GAME_SKU_PREFIXES.get(game, ())

        # 0️⃣ Минтақаи интихобшудаи корбар (агар дар каталоги FireLoot ҳаст)
        want = str(region or "").strip().upper()
        if want:
            by_region = [
                p for p in usable
                if str(p.get("sku", "")).startswith(pre)
                and str(p.get("region") or "").strip().upper() == want
            ]
            if by_region:
                for cat in _GAME_CATEGORY.get(game, ()):
                    cats = [p for p in by_region if p.get("category") == cat]
                    if cats:
                        cats.sort(key=self._price_key)
                        return str(cats[0]["sku"])
                by_region.sort(key=self._price_key)
                return str(by_region[0]["sku"])

        if game == "ff":
            diamonds = [
                p for p in usable
                if p.get("category") == "diamonds"
                and str(p.get("region", "")).upper() == "CIS"
            ]
            if diamonds:
                diamonds.sort(key=lambda p: self._price_key(p.get("price")))
                return str(diamonds[0]["sku"])
            return FALLBACK_SKUS["ff"]

        # 1️⃣ Префикс + категорияи бартарӣ
        for cat in _GAME_CATEGORY.get(game, ()):
            for product in usable:
                sku = str(product.get("sku", ""))
                if sku.startswith(pre) and product.get("category") == cat:
                    return sku
        # 2️⃣ Танҳо префикс
        for product in usable:
            sku = str(product.get("sku", ""))
            if sku.startswith(pre):
                return sku
        # 3️⃣ Фолбэк
        return FALLBACK_SKUS.get(game)

    def candidate_skus(
        self,
        products: list[dict],
        game: str,
        region: str = "",
        prefixes: tuple[str, ...] | None = None,
    ) -> list[str]:
        """SKU барои /validate: аввал минтақаи интихобшуда, баъд фолбэк.

        ⚠️ Агар минтақа интихоб шуда бошад, фолбэк-и минтақаи ДИГАР
        илова намешавад (масалан: MLBB CIS → фолбэк-и Russia нодуруст).
        """
        out: list[str] = []
        picked = self.pick_sku(products, game, region=region, prefixes=prefixes)
        if picked:
            out.append(picked)
        fb = FALLBACK_SKUS.get(game)
        if fb and fb not in out:
            want = str(region or "").strip().upper()
            fb_region = next(
                (
                    str(p.get("region") or "").strip().upper()
                    for p in products
                    if str(p.get("sku") or "") == fb
                ),
                "",
            )
            if not want or not fb_region or fb_region == want:
                out.append(fb)
        return out

    async def validate(self, uid: str, sku: str, zone: str | None = None) -> dict:
        payload: dict = {"sku": sku, "uid": uid}
        if zone:
            payload["zone"] = zone
        async with httpx.AsyncClient(timeout=_VALIDATE_TIMEOUT) as client:
            resp = await client.post(
                f"{self.base}/validate",
                json=payload,
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()
        if not isinstance(data, dict):
            raise ValueError("Bad /validate payload")
        return data


_fireloot = _FireLoot()


# =====================================================================
# 🌍 МИНТАҚАҲО (CIS / BRAZIL / MLBB RUSSIA …) — аз каталоги воқеии FireLoot
# =====================================================================
def regions_for(slug: str, products: list[dict]) -> list[str]:
    """Минтақаҳои воқеии бозӣ — тибқи префикси SKU; пешфарз ҳамеша аввал."""
    prefixes = SLUG_SKU_PREFIXES.get(slug, ())
    if not prefixes:
        return []
    regs: list[str] = []
    for p in products:
        if not str(p.get("sku") or "").startswith(prefixes):
            continue
        r = str(p.get("region") or "").strip()
        if r and r not in regs:
            regs.append(r)
    default = DEFAULT_REGION.get(slug)
    if default in regs:
        return [default, *sorted(r for r in regs if r != default)]
    return sorted(regs)


async def regions_for_slug(slug: str) -> list[str]:
    """Минтақаҳо барои саҳифаи бозӣ — ҳамаи хатогиҳо → [] (саҳифа мешинад)."""
    if not _fireloot.configured:
        return []
    try:
        products = await _fireloot.products()
    except Exception as exc:  # noqa: BLE001
        logger.warning("FireLoot /products (минтақа) ноком: %s", exc)
        return []
    return regions_for(slug, products)


def _split_uid_zone(slug: str, uid: str) -> tuple[str, str | None]:
    """
    Ҷудокунии ID ва Zone (барои MLBB: «12345678 (1234)» ё «12345678 1234»).
    Барои бозиҳои бе zone → танҳо рақамҳо тоза карда мешаванд.
    """
    raw = uid.strip()
    if slug not in GAMES_NEED_ZONE:
        digits = "".join(ch for ch in raw if ch.isdigit())
        return digits or raw, None

    cleaned = raw.rstrip(",")
    for sep in ("(", ",", "|", " ", "\t"):
        if sep in cleaned:
            left, _, right = cleaned.partition(sep)
            left = "".join(ch for ch in left if ch.isdigit())
            right = "".join(ch for ch in right if ch.isdigit())
            if left and right and 2 <= len(right) <= 6:
                return left, right
    only_digits = "".join(ch for ch in cleaned if ch.isdigit())
    return only_digits or cleaned, None


async def _lookup_fireloot(slug: str, uid: str, region: str = "") -> PlayerLookupResponse | None:
    """
    🔥 Логини ник тавассути FireLoot.
    Бармегардонад: ёфт → ё ҷавоби равшан → ё None (ба фолбэк гузар).
    """
    label = GAME_LABEL.get(slug, slug)
    if not _fireloot.configured:
        return None

    game_key = GAME_KEY.get(slug, slug)
    uid_only, zone = _split_uid_zone(slug, uid)

    try:
        products = await _fireloot.products()
    except Exception as exc:  # noqa: BLE001
        logger.warning("FireLoot /products ноком: %s", exc)
        products = []

    skus = _fireloot.candidate_skus(
        products, game_key, region=region, prefixes=SLUG_SKU_PREFIXES.get(slug)
    )
    if not skus:
        return None

    for sku in skus:
        try:
            data = await _fireloot.validate(uid_only, sku, zone)
        except Exception as exc:  # noqa: BLE001
            logger.warning("FireLoot /validate sku=%s err=%s", sku, exc)
            continue

        if not data.get("valid"):
            code = str(data.get("code") or "")
            if code == "invalid_uid":
                return PlayerLookupResponse(
                    found=False, uid=uid, game=label, message="ID ёфт нашуд ❌"
                )
            if code == "region_unsupported":
                shown = (region or "CIS").strip()
                return PlayerLookupResponse(
                    found=False, uid=uid, game=label,
                    message=f"ID вуҷуд дорад, вале регион мувофиқ нест ({shown})",
                )
            if code in ("zone_required", "invalid_zone", "zone_missing"):
                return PlayerLookupResponse(
                    found=False, uid=uid, game=label,
                    message="Zone (сервер) лозим аст — онро дар майдони «Зона» нависед",
                )
            # product_not_found / product_unavailable → SKU-и дигар
            continue

        player_name = str(data.get("player_name") or "").strip()
        region = str(data.get("region") or "").strip().upper()
        if data.get("name_checked") and player_name:
            logger.info("FireLoot ok uid=%s sku=%s nick=%s", uid_only, sku, player_name)
            return PlayerLookupResponse(
                found=True, uid=uid, game=label,
                nickname=player_name, region=region,
            )
        # ✅ ID дуруст санҷида шуд, вале ном барнамегардад (маҳдудияти FireLoot)
        logger.info("FireLoot valid_no_name uid=%s sku=%s", uid_only, sku)
        return PlayerLookupResponse(
            found=False, uid=uid, game=label,
            message=f"ID дуруст ✓ ({region or label}) — вале ном санҷида нашуд",
        )

    return None


# =====================================================================
# 🌐 ФОЛБЭКҳо (epep / wzapi) — ҳамон бот
# =====================================================================
async def _extract_nickname(data: dict) -> str:
    if not isinstance(data, dict):
        return ""
    for key in ("nickname", "name", "player_name", "playerName",
                "AccountName", "account_name"):
        v = data.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    for nk in ("basicInfo", "basicinfo", "BasicInfo", "data", "player", "account"):
        nested = data.get(nk)
        if isinstance(nested, dict):
            found = await _extract_nickname(nested)
            if found:
                return found
    return ""


async def _extract_region(data: dict) -> str:
    if not isinstance(data, dict):
        return ""
    for key in ("region", "server", "Region", "Server"):
        v = data.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip().upper()
    for nk in ("basicInfo", "basicinfo", "BasicInfo", "data"):
        nested = data.get(nk)
        if isinstance(nested, dict):
            found = await _extract_region(nested)
            if found:
                return found
    return ""


async def _lookup_free_fire(uid: str) -> PlayerLookupResponse:
    """Free Fire аз epep-api + wzapi (мувофиқи бот: 6 регион)."""
    label = GAME_LABEL["free-fire"]
    regions = ("ind", "sg", "br", "us", "id", "ru")

    async with httpx.AsyncClient(
        timeout=_API_TIMEOUT,
        headers={"User-Agent": _LOOKUP_UA, "Accept": "application/json"},
    ) as client:
        for region in regions:
            # --- epep-api ---
            try:
                resp = await client.get(
                    "https://epep-api.vercel.app/api/freefire/player/profile",
                    params={"server": region, "uid": uid,
                            "need_gallery_info": "false", "call_sign_src": "7"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and data.get("status") != "error":
                        nick = await _extract_nickname(data)
                        if nick:
                            return PlayerLookupResponse(
                                found=True, uid=uid, game=label, nickname=nick,
                                region=await _extract_region(data) or region.upper(),
                            )
            except Exception:  # noqa: BLE001
                pass

            # --- wzapiinfo ---
            try:
                resp = await client.get(
                    "https://wzapiinfo.vercel.app/get",
                    params={"uid": uid, "region": region},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and not data.get("error"):
                        nick = await _extract_nickname(data)
                        if nick:
                            return PlayerLookupResponse(
                                found=True, uid=uid, game=label, nickname=nick,
                                region=await _extract_region(data) or region.upper(),
                            )
            except Exception:  # noqa: BLE001
                pass

    return PlayerLookupResponse(found=False, uid=uid, game=label,
                                message="Ник ёфт нашуд")


async def _lookup_wzapi(uid: str, slug: str) -> PlayerLookupResponse:
    """Фолбэк аз wzapiinfo."""
    label = GAME_LABEL.get(slug, slug)
    async with httpx.AsyncClient(
        timeout=_API_TIMEOUT, headers={"User-Agent": _LOOKUP_UA, "Accept": "application/json"}
    ) as client:
        for url in (
            f"https://wzapiinfo.vercel.app/get?uid={uid}&region=ind",
            f"https://wzapiinfo.vercel.app/get?uid={uid}&region=sg",
        ):
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and not data.get("error"):
                        nick = await _extract_nickname(data)
                        if nick:
                            return PlayerLookupResponse(
                                found=True, uid=uid, game=label,
                                nickname=nick, region=await _extract_region(data),
                            )
            except Exception:  # noqa: BLE001
                continue
    return PlayerLookupResponse(found=False, uid=uid, game=label,
                                message="Ник ёфт нашуд")


# =====================================================================
# 📡 ЭНДПОИНТ
# =====================================================================
@router.get("/{slug}/lookup", response_model=PlayerLookupResponse)
async def lookup_player(
    slug: str,
    uid: str = Query(..., min_length=3, max_length=64, description="Player ID / UID"),
    region: str = Query("", max_length=64, description="Минтақаи интихобшуда"),
):
    """
    Логини никном ба Player ID.

    Тартибот (ҳамон бот): FireLoot → epep (FF) → wzapi.
    """
    uid = uid.strip()

    # ✅ Валидатсияи асосӣ (ҳамон бот: рақам, мин 8 — ё бо zone барои MLBB)
    uid_only, zone = _split_uid_zone(slug, uid)
    digits = "".join(ch for ch in uid_only if ch.isdigit())
    min_len = 7 if slug in GAMES_NEED_ZONE else 8
    if not digits or len(digits) < min_len:
        return PlayerLookupResponse(
            found=False, uid=uid, game=GAME_LABEL.get(slug, slug),
            message=f"ID нодуруст (фақат рақам, мин {min_len} рақам)",
        )

    # 1️⃣ FireLoot — манбаи асосӣ
    try:
        result = await _lookup_fireloot(slug, uid, region=region)
    except Exception as exc:  # noqa: BLE001
        logger.warning("FireLoot lookup хато uid=%s: %s", uid, exc)
        result = None
    if result is not None:
        return result

    # 2️⃣ Фолбэкҳо
    if slug == "free-fire":
        return await _lookup_free_fire(uid)
    return await _lookup_wzapi(uid, slug)
