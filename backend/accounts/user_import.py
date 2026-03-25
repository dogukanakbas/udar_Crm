"""Ad soyad listesinden kullanıcı adı üretme (e-posta olmadan giriş için)."""
from __future__ import annotations

import re
import unicodedata

# Yaygın Türkçe harfler (ASCII kullanıcı adına indirgeme)
_TR_MAP = str.maketrans(
    {
        'ı': 'i',
        'İ': 'i',
        'ğ': 'g',
        'Ğ': 'g',
        'ü': 'u',
        'Ü': 'u',
        'ş': 's',
        'Ş': 's',
        'ö': 'o',
        'Ö': 'o',
        'ç': 'c',
        'Ç': 'c',
    }
)


def full_name_to_username_base(full_name: str) -> str:
    """Örn. 'Ali Yılmaz' -> 'ali.yilmaz'"""
    s = (full_name or '').strip()
    if not s:
        return 'kullanici'
    s = s.translate(_TR_MAP)
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '.', s)
    s = re.sub(r'\.\.+', '.', s).strip('.')
    if not s or not re.match(r'^[a-z0-9]', s):
        s = 'kullanici' + re.sub(r'\W', '', s)[:8]
    if len(s) > 100:
        s = s[:100].rstrip('.')
    return s or 'kullanici'


def allocate_username(base: str, is_taken) -> str:
    """
    base: örn. ali.yilmaz
    is_taken: (str) -> bool
    """
    base = base[:150] if len(base) > 150 else base
    if not is_taken(base):
        return base
    for n in range(2, 10000):
        candidate = f'{base}.{n}'[:150]
        if not is_taken(candidate):
            return candidate
    raise ValueError('Benzersiz kullanıcı adı üretilemedi')


def split_full_name(full_name: str) -> tuple[str, str]:
    parts = (full_name or '').strip().split(None, 1)
    if not parts:
        return '', ''
    first = parts[0]
    last = parts[1] if len(parts) > 1 else ''
    return first, last
