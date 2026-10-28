"""
Email service - SMTP (Tajik language HTML template)
If SMTP not configured, email silently skipped.
"""
from __future__ import annotations

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate
from html import escape

from app.config import settings


def send_balance_topup_email(
    to_email: str,
    user_id: int,
    amount_added: float,
    new_balance: float,
    date_str: str,
) -> bool:
    """Send balance top-up notification email to user."""
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME:
        # SMTP not configured -> silently skip
        return False

    subject = "✅ Balansi shumo azoda shud"

    html_body = f"""    <!DOCTYPE html>
    <html lang="tj">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Balansi shumo azoda shud</title>
        <style>
            body {{
                font-family: 'Onest', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                background-color: #f3f4f6;
                padding: 24px;
                border-radius: 8px;
            }}
            .card {{
                background-color: #ffffff;
                border-radius: 12px;
                padding: 32px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }}
            .header {{
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 24px;
            }}
            .icon {{
                font-size: 32px;
            }}
            h1 {{
                color: #1f2937;
                margin: 0;
                font-size: 24px;
                font-weight: 700;
            }}
            .badge {{
                display: inline-block;
                background-color: #dcfce7;
                color: #166534;
                padding: 4px 12px;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-top: 12px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 24px;
            }}
            td {{
                padding: 12px 0;
                border-bottom: 1px solid #e5e7eb;
                font-size: 14px;
            }}
            td:first-child {{
                color: #6b7280;
                font-weight: 500;
                width: 40%;
            }}
            td:last-child {{
                text-align: right;
                font-weight: 700;
                color: #1f2937;
            }}
            tr:last-child td {{
                border-bottom: none;
            }}
            .amount {{
                color: #16a34a;
                font-weight: 800;
            }}
            .footer {{
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid #e5e7eb;
                color: #9ca3af;
                font-size: 13px;
                line-height: 1.5;
            }}
            .footer a {{
                color: #2563eb;
                text-decoration: none;
            }}
            .footer a:hover {{
                text-decoration: underline;
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <span class="icon">✅</span>
                <div>
                    <h1>Balansi shumo azoda shud</h1>
                    <span class="badge">Tasdiqshuda</span>
                </div>
            </div>
            <table>
                <tr>
                    <td>User ID</td>
                    <td>{user_id}</td>
                </tr>
                <tr>
                    <td>Ilozashuda (TJS)</td>
                    <td class="amount">{amount_added:,.2f} somonˇi</td>
                </tr>
                <tr>
                    <td>Balansi jor'ˍ</td>
                    <td class="amount">{new_balance:,.2f} somonˇi</td>
                </tr>
                <tr>
                    <td>Sana</td>
                    <td>{date_str}</td>
                </tr>
            </table>
            <div class="footer">
                <p>Balansi shumo muvaffaqiyat shud.</p>
                <p>Agar in amaliot ro na khud kardid, lotfan ba admin rabta kuned.</p>
                <p>
                    <a href="{settings.FRONTEND_URL}/profile">Ba profil boraved</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Date"] = formatdate(localtime=True)

        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)

        return True

    except Exception:
        # Email failure won't block balance credit
        return False


def send_balance_admin_email(
    *,
    to_email: str,
    user_id: int,
    user_label: str,
    amount: float,
    new_balance: float,
    reason: str,
    admin_label: str,
    date_str: str,
) -> bool:
    """
    📩 Огоҳиномаи EMAIL барои админ ҳангоми ПУР КАРДАНИ баланси корбар.

    Тафсилоти маблағ: корбари ҳадаф · маблағи илова · баланси нав ·
    сабаб · кӣ илова кард · сана.
    SMTP холӣ → False (хомӯш, бе хатогӣ) — ҷавоби админро бозмедорад.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME:
        return False

    # XSS: сабаб ва номҳо аз админ/корбар меоянд → ҳатмӣ escape
    _user = escape(f"{user_label} (ID {user_id})")
    _reason = escape(reason or "—")
    _admin = escape(admin_label or "—")
    _date = escape(date_str or "—")

    subject = "💰 Баланс пур карда шуд"

    html_body = f"""    <!DOCTYPE html>
    <html lang="tj">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Баланс пур карда шуд</title>
        <style>
            body {{
                font-family: 'Onest', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                background-color: #f3f4f6;
                padding: 24px;
                border-radius: 8px;
            }}
            .card {{
                background-color: #ffffff;
                border-radius: 12px;
                padding: 32px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }}
            .header {{
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 24px;
            }}
            .icon {{ font-size: 32px; }}
            h1 {{
                color: #1f2937;
                margin: 0;
                font-size: 24px;
                font-weight: 700;
            }}
            .badge {{
                display: inline-block;
                background-color: #dbeafe;
                color: #1e40af;
                padding: 4px 12px;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-top: 12px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 24px;
            }}
            td {{
                padding: 12px 0;
                border-bottom: 1px solid #e5e7eb;
                font-size: 14px;
            }}
            td:first-child {{
                color: #6b7280;
                font-weight: 500;
                width: 42%;
            }}
            td:last-child {{
                text-align: right;
                font-weight: 700;
                color: #1f2937;
            }}
            tr:last-child td {{ border-bottom: none; }}
            .amount {{
                color: #2563eb;
                font-weight: 800;
            }}
            .footer {{
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid #e5e7eb;
                color: #9ca3af;
                font-size: 13px;
                line-height: 1.5;
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <span class="icon">💰</span>
                <div>
                    <h1>Баланс пур карда шуд</h1>
                    <span class="badge">Илова карда шуд</span>
                </div>
            </div>
            <table>
                <tr>
                    <td>Корбар</td>
                    <td>{_user}</td>
                </tr>
                <tr>
                    <td>Маблағи илова</td>
                    <td class="amount">{amount:,.2f} сомонӣ</td>
                </tr>
                <tr>
                    <td>Баланси нав</td>
                    <td class="amount">{new_balance:,.2f} сомонӣ</td>
                </tr>
                <tr>
                    <td>Сабаб</td>
                    <td>{_reason}</td>
                </tr>
                <tr>
                    <td>Илова кард</td>
                    <td>{_admin}</td>
                </tr>
                <tr>
                    <td>Сана</td>
                    <td>{_date}</td>
                </tr>
            </table>
            <div class="footer">
                <p>Ин огоҳинома аз ҷониби системаи Danatel.tj автоматӣ фиристода шуд.</p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Date"] = formatdate(localtime=True)

        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)

        return True

    except Exception:
        # Email failure won't block balance credit
        return False
