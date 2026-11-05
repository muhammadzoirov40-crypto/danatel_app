"""😶 Тестҳои Face Authentication (FastAPI + SQLite тестӣ).

Сенарияҳо:
  1  Чолиши лайвлес (challenge): бе вуруд, амали тасодуфӣ, 60s
  2  Сабти чеҳра: бе токен → 401; бе розигӣ → 422
  3  Сабти чеҳра → /status = registered
  4  ЯК credential: сабти дубра = навсозӣ (descriptor-и кӯҳна кор намекунад)
  5  Вуруд бо чеҳра → ҳамон токени JWT → /auth/me
  6  Чеҳраи бегона → 401 (паёми ягона, бе ифшои аккаунт)
  7  Replay-и challenge → 400
  8  Challenge-и муҳлаташ гузашта → 400
  9  Амали нодуруст (action mismatch) → 400
 10  Rate-limit: 11 кӯшиши вуруд → 429
 11  Нест кардани credential → status=false + вуруд ноком
 12  Рамзгузорӣ: дар DB байти рамзшуда (на vector-и оддӣ); decrypt ≈ normalize
 13  Парол ҳамеша кор мекунад (регрессияи /login пас аз face)
 14  Дарвозаи парол: confirm-password → 200/403/401/429 (rate 10/5 дақ)
 15  Бе pw_ticket → 428 (чолиш сӯзонда намешавад); тамеринг → 428
"""
from __future__ import annotations

import math
import random
import struct
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.models import FaceChallenge, FaceCredential, User
from app.services import face_crypto

PASSWORD = "FaceTest2026!"
FACE_FAILED = "Чеҳра шинохта нашуд — лутфан бо парол вуруд кунед"


# =====================================================================
# 🧰 Ёрӣ
# =====================================================================
def new_phone() -> str:
    return "992" + str(uuid.uuid4().int % 1_000_000_000).zfill(9)


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def make_user(client: TestClient) -> tuple[str, str]:
    """Қайди корбар → (телефон, токен)."""
    phone = new_phone()
    r = client.post(
        "/api/auth/register",
        json={"phone": phone, "password": PASSWORD, "language": "tj"},
    )
    assert r.status_code == 200, r.text
    return phone, r.json()["access_token"]


def descriptor(seed: float) -> list[float]:
    """Descriptor-и 128-уҷаи детерминӣ + L2-normalized (ҳамон чӣ face-api.js).

    ⚠️ НА аз рӯйи `sin(seed+…)` — фаза тақрибан 2π такрор мешавад
    (8.4 − 2π ≈ 2.3) → ду «гунаи гуногун» тақрибан якхела мебаромад
    ва вуруди бегона ба ҷои 401 → 200 медод. Gaussian-и детерминӣ:
    дар 128-уҷа масофаи тасодуфии ду вектор ≈ √2 ≈ 1.41 (>> 0.6) ✅.
    """
    rng = random.Random(int(round(seed * 1000)))
    vals = [rng.gauss(0.0, 1.0) for _ in range(128)]
    n = math.sqrt(sum(v * v for v in vals))
    return [v / n for v in vals]


def challenge(client: TestClient) -> tuple[str, str]:
    """Чолиши нав → (challenge_id, action)."""
    r = client.post("/api/auth/face/challenge")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["action"] in ("blink", "mouth")
    assert data["expires_in"] == 60
    return data["challenge_id"], data["action"]


def pw_ticket(client: TestClient, token: str) -> str:
    """🔑 Дарвозаи парол: confirm-password → ticket барои /register."""
    r = client.post(
        "/api/auth/face/confirm-password",
        headers=auth(token),
        json={"password": PASSWORD},
    )
    assert r.status_code == 200, r.text
    return r.json()["ticket"]


def face_register(
    client: TestClient, token: str, desc: list[float], consent: bool = True
):
    cid, action = challenge(client)
    return client.post(
        "/api/auth/face/register",
        headers=auth(token),
        json={
            "descriptor": desc,
            "challenge_id": cid,
            "action_done": action,
            "consent": consent,
            "pw_ticket": pw_ticket(client, token),
        },
    )


def face_login(client: TestClient, desc: list[float]):
    cid, action = challenge(client)
    return client.post(
        "/api/auth/face/login",
        json={"descriptor": desc, "challenge_id": cid, "action_done": action},
    )


# =====================================================================
# 1) ЧОЛИШИ ЛАЙВЛЕС
# =====================================================================
def test_challenge_ok(client: TestClient):
    r = client.post("/api/auth/face/challenge")
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["challenge_id"]) >= 8
    assert data["action"] in ("blink", "mouth")


def test_challenge_unique_ids(client: TestClient):
    ids = {challenge(client)[0] for _ in range(3)}
    assert len(ids) == 3, "challenge_id-ҳо бояд беназир бошанд"


# =====================================================================
# 2) САБТ: авторизация + розигӣ
# =====================================================================
def test_register_requires_auth(client: TestClient):
    cid, action = challenge(client)
    r = client.post(
        "/api/auth/face/register",
        json={
            "descriptor": descriptor(0.5),
            "challenge_id": cid,
            "action_done": action,
            "consent": True,
        },
    )
    assert r.status_code in (401, 403), r.text


def test_register_requires_consent(client: TestClient):
    _, token = make_user(client)
    desc = descriptor(1.1)
    cid, action = challenge(client)
    r = client.post(
        "/api/auth/face/register",
        headers=auth(token),
        json={
            "descriptor": desc,
            "challenge_id": cid,
            "action_done": action,
            "consent": False,
        },
    )
    assert r.status_code == 422, r.text
    # чолиш сӯзонда нашуд (consent ПЕШ санҷида мешавад) → ҳамон чолиш такроран
    r2 = client.post(
        "/api/auth/face/register",
        headers=auth(token),
        json={
            "descriptor": desc,
            "challenge_id": cid,
            "action_done": action,
            "consent": True,
            "pw_ticket": pw_ticket(client, token),
        },
    )
    assert r2.status_code == 200, r2.text


def test_register_and_status(client: TestClient):
    _, token = make_user(client)
    desc = descriptor(2.3)

    r = face_register(client, token, desc)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["registered"] is True
    assert body["registered_at"]

    s = client.get("/api/auth/face/status", headers=auth(token))
    assert s.status_code == 200, s.text
    assert s.json()["registered"] is True


def test_status_without_auth(client: TestClient):
    r = client.get("/api/auth/face/status")
    assert r.status_code in (401, 403), r.text


# =====================================================================
# 4) ТАНҲО ЯК CREDENTIAL (сабти дубра = навсозӣ)
# =====================================================================
def test_reregister_replaces_credential(client: TestClient):
    phone, token = make_user(client)
    old_desc = descriptor(3.1)
    new_desc = descriptor(4.7)

    assert face_register(client, token, old_desc).status_code == 200
    assert face_register(client, token, new_desc).status_code == 200

    # descriptor-и нав кор мекунад
    r = face_login(client, new_desc)
    assert r.status_code == 200, r.text
    # descriptor-и кӯҳна дигар кор намекунад (ягона credential = навсозӣ)
    r_old = face_login(client, old_desc)
    assert r_old.status_code == 401, r_old.text

    # дар DB танҳо ЯК сатр барои ҳамин корбар
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.phone == phone).first()
        assert user is not None
        n = (
            db.query(FaceCredential)
            .filter(FaceCredential.user_id == user.id)
            .count()
        )
        assert n == 1, f"face_credentials бояд 1 сатр бошад, нест: {n}"
    finally:
        db.close()


# =====================================================================
# 5–6) ВУРУД БО ЧЕҲРА
# =====================================================================
def test_face_login_match_and_token(client: TestClient):
    phone, token = make_user(client)
    desc = descriptor(5.5)
    assert face_register(client, token, desc).status_code == 200

    r = face_login(client, desc)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"]

    # ҳамон токени JWT-и оддӣ → /auth/me
    me = client.get("/api/auth/me", headers=auth(body["access_token"]))
    assert me.status_code == 200, me.text
    assert me.json()["phone"] == phone


def test_face_login_wrong_face(client: TestClient):
    _, token = make_user(client)
    assert face_register(client, token, descriptor(6.2)).status_code == 200

    r = face_login(client, descriptor(7.9))  # дигар гуна
    assert r.status_code == 401, r.text
    assert r.json()["detail"] == FACE_FAILED


def test_face_login_no_credentials(client: TestClient):
    make_user(client)  # ҳисоби бе чеҳра
    r = face_login(client, descriptor(8.4))
    assert r.status_code == 401, r.text
    assert r.json()["detail"] == FACE_FAILED


# =====================================================================
# 7–9) CHALLENGE: replay / муҳлат / action
# =====================================================================
def test_challenge_replay_rejected(client: TestClient):
    _, token = make_user(client)
    cid, action = challenge(client)
    payload = {
        "descriptor": descriptor(9.1),
        "challenge_id": cid,
        "action_done": action,
        "consent": True,
        "pw_ticket": pw_ticket(client, token),
    }
    r1 = client.post("/api/auth/face/register", headers=auth(token), json=payload)
    assert r1.status_code == 200, r1.text
    # такроран ҲАМОН чолиш → якдафъаӣ нест
    r2 = client.post("/api/auth/face/register", headers=auth(token), json=payload)
    assert r2.status_code == 400, r2.text


def test_challenge_expired_rejected(client: TestClient):
    _, token = make_user(client)
    cid, action = challenge(client)

    db = SessionLocal()
    try:
        ch = db.get(FaceChallenge, cid)
        assert ch is not None
        ch.expires_at = datetime(2020, 1, 1)
        db.commit()
    finally:
        db.close()

    r = client.post(
        "/api/auth/face/register",
        headers=auth(token),
        json={
            "descriptor": descriptor(10.3),
            "challenge_id": cid,
            "action_done": action,
            "consent": True,
            "pw_ticket": pw_ticket(client, token),
        },
    )
    assert r.status_code == 400, r.text


def test_action_mismatch_rejected(client: TestClient):
    _, token = make_user(client)
    cid, action = challenge(client)
    other = "mouth" if action == "blink" else "blink"
    r = client.post(
        "/api/auth/face/register",
        headers=auth(token),
        json={
            "descriptor": descriptor(11.6),
            "challenge_id": cid,
            "action_done": other,
            "consent": True,
            "pw_ticket": pw_ticket(client, token),
        },
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "Амали лайвлес иҷро нашуд"


# =====================================================================
# 10) RATE-LIMIT
# =====================================================================
def test_face_login_rate_limit(client: TestClient):
    _, token = make_user(client)
    assert face_register(client, token, descriptor(12.2)).status_code == 200

    wrong = descriptor(13.8)
    statuses = []
    for _ in range(11):
        r = face_login(client, wrong)
        statuses.append(r.status_code)
    # 10-таи аввал = 401 (кӯшиш), 11-ум = 429
    assert statuses[:10] == [401] * 10, statuses
    assert statuses[10] == 429, statuses


# =====================================================================
# 11) НЕСТ КАРДАН
# =====================================================================
def test_delete_credential(client: TestClient):
    _, token = make_user(client)
    desc = descriptor(14.5)
    assert face_register(client, token, desc).status_code == 200

    d = client.delete("/api/auth/face/credential", headers=auth(token))
    assert d.status_code == 200, d.text
    assert d.json()["ok"] is True

    s = client.get("/api/auth/face/status", headers=auth(token))
    assert s.json()["registered"] is False

    r = face_login(client, desc)
    assert r.status_code == 401, r.text


# =====================================================================
# 12) РАМЗГУЗОРИӢ
# =====================================================================
def test_descriptor_encrypted_in_db(client: TestClient):
    phone, token = make_user(client)
    desc = descriptor(15.9)
    assert face_register(client, token, desc).status_code == 200

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.phone == phone).first()
        assert user is not None
        cred = (
            db.query(FaceCredential)
            .filter(FaceCredential.user_id == user.id)
            .first()
        )
        assert cred is not None, "credential сабт нашуд"

        # 1) Дар DB ТАНҲО байти рамзшуда: plaintext-и vector дар он НЕСТ
        plaintext = struct.pack("<128f", *face_crypto.normalize(desc))
        assert plaintext not in bytes(cred.descriptor_enc), "vector оддӣ дар DB нигоҳ дошта шуд!"
        assert bytes(cred.descriptor_enc) != plaintext

        # 2) Decrypt → ҳамон descriptor (тақрибан)
        decoded = face_crypto.decrypt_descriptor(bytes(cred.descriptor_enc))
        assert decoded == pytest.approx(face_crypto.normalize(desc), rel=1e-5, abs=1e-6)

        # 3) Розигӣ сабт шуд
        assert cred.consent_at is not None
        assert cred.model_version == "faceapi_v1"
    finally:
        db.close()


# =====================================================================
# 13) РЕГРЕССИЯ: парол ҳамеша кор мекунад
# =====================================================================
def test_password_login_still_works_after_face(client: TestClient):
    phone, token = make_user(client)
    assert face_register(client, token, descriptor(16.4)).status_code == 200

    r = client.post(
        "/api/auth/login", json={"phone": phone, "password": PASSWORD}
    )
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]


# =====================================================================
# 14–15) ДАРВОЗАИ ПАРОЛ (step-up пеш аз сабти чеҳра)
# =====================================================================
def test_confirm_password_ok(client: TestClient):
    _, token = make_user(client)
    r = client.post(
        "/api/auth/face/confirm-password",
        headers=auth(token),
        json={"password": PASSWORD},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["expires_in"] == 300
    assert body["ticket"].count(".") == 2
    # Ҳамон ticket → /register кушода мекунад
    cid, action = challenge(client)
    rr = client.post(
        "/api/auth/face/register",
        headers=auth(token),
        json={
            "descriptor": descriptor(17.2),
            "challenge_id": cid,
            "action_done": action,
            "consent": True,
            "pw_ticket": body["ticket"],
        },
    )
    assert rr.status_code == 200, rr.text


def test_register_requires_pw_ticket(client: TestClient):
    """Бе ticket → 428; чолиш СЎЗОНДА НАМЕШАВАД → бо ticket 200."""
    _, token = make_user(client)
    cid, action = challenge(client)
    base = {
        "descriptor": descriptor(18.5),
        "challenge_id": cid,
        "action_done": action,
        "consent": True,
    }
    r = client.post("/api/auth/face/register", headers=auth(token), json=base)
    assert r.status_code == 428, r.text
    # чолиш сӯзонда нашуд → ҳамон чолиш + ticket → 200
    r2 = client.post(
        "/api/auth/face/register",
        headers=auth(token),
        json={**base, "pw_ticket": pw_ticket(client, token)},
    )
    assert r2.status_code == 200, r2.text


def test_confirm_password_wrong(client: TestClient):
    _, token = make_user(client)
    r = client.post(
        "/api/auth/face/confirm-password",
        headers=auth(token),
        json={"password": "wrong-pass-9"},
    )
    # 403 (НА 401 — 401 дар клиент сеансро мешиканад)
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == "Парол нодуруст аст"


def test_confirm_password_requires_auth(client: TestClient):
    r = client.post(
        "/api/auth/face/confirm-password", json={"password": PASSWORD}
    )
    assert r.status_code in (401, 403), r.text


def test_pw_ticket_tampered_rejected(client: TestClient):
    _, token = make_user(client)
    cid, action = challenge(client)
    r = client.post(
        "/api/auth/face/register",
        headers=auth(token),
        json={
            "descriptor": descriptor(19.1),
            "challenge_id": cid,
            "action_done": action,
            "consent": True,
            "pw_ticket": "1.9999999999.deadbeef",  # имзо қалбакӣ
        },
    )
    assert r.status_code == 428, r.text


def test_confirm_password_rate_limit(client: TestClient):
    _, token = make_user(client)
    statuses = []
    for _ in range(11):
        r = client.post(
            "/api/auth/face/confirm-password",
            headers=auth(token),
            json={"password": "wrong-pass-9"},
        )
        statuses.append(r.status_code)
    assert statuses[:10] == [403] * 10, statuses
    assert statuses[10] == 429, statuses
