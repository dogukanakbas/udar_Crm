# Migration & Seed Strategy (Özet)

## Demo / Prod Ayrımı
- Demo seed yalnızca dev/stage ortamında çalıştır; prod’da kapalı tut.
- Test seed ayrı komutla (ör. `manage.py seed_testdata`) ve yalnızca test/stage’de.

## Migration Rehberi
- Her uzun sürecek migration (büyük tabloya kolon ekleme, index, data backfill) için:
  - Öncesi backup: pg_dump.
  - Bakım modu: kısa süreli 503 (Nginx) veya read-only flag; istekleri kuyrukla.
  - Adım adım: şema ekle → kodu deploy et (iki sürüm uyumlu) → data backfill → eski kolonları sonra kaldır.
  - Index ekleme: `CONCURRENTLY` tercih et (postgres).
  - Geri dönüş: başarısız olursa migration’ı revert et, backup’tan dön.

## Seed / Permissions
- `seed_permissions` sadece eksik izin/rol ekler; prod’da güvenli.
- Demo seed prod’da koşma: env bayraklarıyla engelle (`ENABLE_DEMO_SEED=false`).

## Operasyonel Notlar
- Uzun backfill işlemleri için Celery task veya yönetim komutu (id aralığıyla, batch).
- Migrasyon sırasında worker/beat gerekli mi? Task/cron kapatılabilir veya bakım moduna alınabilir.

