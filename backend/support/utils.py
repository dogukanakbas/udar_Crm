import requests
import hmac
import base64
import hashlib
import time
from urllib.parse import urlencode
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


def generate_presigned_post(
    *,
    endpoint: str,
    bucket: str,
    key: str,
    access_key: str,
    secret_key: str,
    secure: bool = False,
    region: str = "us-east-1",
    content_type: str = "",
    max_size: int = 10 * 1024 * 1024,
):
    """
    Basit S3/MinIO presigned POST üretir. Kısıtlama: content-type eşleşmesi ve max_size.
    """
    scheme = "https" if secure else "http"
    url = f"{scheme}://{endpoint}/{bucket}"
    expire_seconds = 3600
    expire_at = int(time.time()) + expire_seconds

    policy_dict = {
        "expiration": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(expire_at)),
        "conditions": [
            {"bucket": bucket},
            ["starts-with", "$key", key],
            ["eq", "$Content-Type", content_type],
            ["content-length-range", 0, max_size],
        ],
    }
    import json
    policy = base64.b64encode(json.dumps(policy_dict).encode()).decode()
    signature = base64.b64encode(
        hmac.new(secret_key.encode(), policy.encode(), hashlib.sha1).digest()
    ).decode()

    return {
        "url": url,
        "fields": {
            "key": key,
            "AWSAccessKeyId": access_key,
            "policy": policy,
            "signature": signature,
            "Content-Type": content_type,
        },
    }


def scan_file_with_clamav(file_bytes: bytes) -> bool:
    """
    Basit ClamAV socket taraması. Env: CLAMAV_ENABLED=true, CLAMAV_HOST, CLAMAV_PORT
    true dönerse temizdir, false veya exception durumda yükleme reddedilebilir.
    """
    try:
        import socket
    except ImportError:
        return True
    enabled = str(getattr(settings, 'CLAMAV_ENABLED', 'false')).lower() == 'true'
    if not enabled:
        return True
    host = getattr(settings, 'CLAMAV_HOST', 'clamav')
    port = int(getattr(settings, 'CLAMAV_PORT', 3310))
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((host, port))
        sock.sendall(b"zINSTREAM\0")
        chunk_size = 1024
        offset = 0
        while offset < len(file_bytes):
            chunk = file_bytes[offset:offset + chunk_size]
            sock.sendall(len(chunk).to_bytes(4, byteorder='big') + chunk)
            offset += chunk_size
        sock.sendall((0).to_bytes(4, byteorder='big'))
        resp = sock.recv(1024).decode()
        sock.close()
        return "OK" in resp
    except Exception:
        return False

