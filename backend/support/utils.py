import requests
from django.conf import settings
from typing import Optional


def send_slack_webhook(message: str, webhook_url: Optional[str] = None):
    url = webhook_url or getattr(settings, 'SLACK_WEBHOOK_URL', None)
    if not url:
        return False
    try:
        requests.post(url, json={'text': message}, timeout=3)
        return True
    except Exception:
        return False


def send_email(to_email: str, subject: str, body: str):
    """
    Basic SMTP sender using settings.SMTP_HOST/PORT/USER/PASSWORD/USE_TLS.
    If SMTP_HOST missing, fallback to console print.
    """
    host = getattr(settings, 'SMTP_HOST', None)
    port = int(getattr(settings, 'SMTP_PORT', 587))
    user = getattr(settings, 'SMTP_USER', None)
    password = getattr(settings, 'SMTP_PASSWORD', None)
    use_tls = getattr(settings, 'SMTP_USE_TLS', True)
    if not host:
        print(f"[EMAIL STUB] To: {to_email} | Subject: {subject} | Body: {body}")
        return True
    import smtplib
    from email.mime.text import MIMEText

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = user or 'no-reply@udarcrm.local'
    msg['To'] = to_email

    try:
        server = smtplib.SMTP(host, port, timeout=5)
        if use_tls:
            server.starttls()
        if user and password:
            server.login(user, password)
        server.send_message(msg)
        server.quit()
        return True
    except Exception:
        return False

