# -*- coding: utf-8 -*-
"""Эълони Telegram: ҳузвати харидор (`user_label`).

Ҳамаи ҷузъҳои мавҷудбуда ҷамъ мешаванд: Ном · @username · 📞 рақам;
танҳо мавҷудбудаҳо → ҷаълӣ нест; HTML-escape → номи бад наметарконад.
"""
from types import SimpleNamespace

from app.services.telegram_service import user_label


def _user(**kw):
    base = {"id": 7, "full_name": None, "username": None, "phone": None}
    base.update(kw)
    return SimpleNamespace(**base)


def test_all_parts_together():
    """Ном + @username + рақам ДАР ЯК САТР (на яке ба ҷои дигаре)."""
    u = _user(full_name="Муҳаммад", username="momo", phone="+992900111222")
    assert user_label(u) == "Муҳаммад · @momo · 📞 +992900111222"


def test_username_without_at_prefix():
    """Username бо @ дар оғоз → @ такрорӣ НАМЕШАВАД."""
    u = _user(username="@momo")
    assert user_label(u) == "@momo"


def test_only_phone_shows_number():
    u = _user(phone="992900111222")
    assert user_label(u) == "📞 992900111222"


def test_only_username():
    u = _user(username="sardor")
    assert user_label(u) == "@sardor"


def test_no_parts_falls_back_to_id():
    u = _user()
    assert user_label(u) == "#7"


def test_none_user_returns_none():
    """Мизоҷи бе ҳисоб → сатр илова намешавад."""
    assert user_label(None) is None


def test_html_escaped():
    """Номи истифодабаранда бо <...> → HTML парокан намешавад."""
    u = _user(full_name="<b>x</b>")
    label = user_label(u)
    assert label is not None
    assert "<b>" not in label
    assert "&lt;b&gt;" in label
