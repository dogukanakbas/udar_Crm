import re
import json
from django.utils.deprecation import MiddlewareMixin


SENSITIVE_KEYS = {"password", "old_password", "new_password", "token", "secret", "otp"}
SENSITIVE_PATTERNS = [
    re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),  # email
]


def mask_value(val: str) -> str:
    if not val:
        return val
    if len(val) <= 3:
        return "***"
    return val[:1] + "***" + val[-1:]


class PiiMaskingMiddleware(MiddlewareMixin):
    """
    Masks common PII in request bodies before logging.
    To be effective, ensure request logging is centralized and passes through this middleware.
    """

    def process_request(self, request):
        # mask POST/PUT/PATCH body if JSON
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body = request.body.decode("utf-8")
                data = json.loads(body)
                changed = False
                for k, v in list(data.items()):
                    if k.lower() in SENSITIVE_KEYS and isinstance(v, str):
                        data[k] = mask_value(v)
                        changed = True
                    elif isinstance(v, str):
                        for pat in SENSITIVE_PATTERNS:
                            if pat.search(v):
                                data[k] = pat.sub("***", v)
                                changed = True
                if changed:
                    request._pii_masked_body = json.dumps(data)
            except Exception:
                pass
        return None

