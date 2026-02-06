# Incident Runbook (Özet)

## 1) Triage
- Kaynak: kullanıcı şikayeti, monitör/uptime alarmı, log/alert.
- Derhal topla: zaman, etkilenen endpoint/işlev, HTTP kodları, kullanıcı/organizasyon, tarayıcı/istemci versiyonu.
- Öncelik: P0 (tümü down), P1 (ana akış bozuk), P2 (kısmi), P3 (minör).

## 2) Hızlı Kontroller
- Sağlık: `GET /health/` (backend/db/redis).
- Container durumu: `docker-compose ps`, loglar: `docker-compose logs backend/frontend -n 100`.
- DNS/SSL: `dig`, `curl -Iv https://domain`, sertifika süresi.
- Rate-limit / 401: token süresi, login throttling.

## 3) Yaygın Senaryolar
- 5xx / 502: backend pod/konteyner ayakta mı, gunicorn error log, DB bağlantı hatası.
- 4xx CORS/CSRF: origin/host mismatch, env’de ALLOWED_HOSTS/CORS/CSRF_TRUSTED_ORIGINS kontrolü.
- SSE/WS 401: token query param eksik/expired; login sonrası startSse çağrısı; CORS upgrade izinleri.
- Presigned upload: PRESIGN_* env dolu mu, content-type/size sınırı, MinIO/S3 erişimi.
- Celery/SLA: worker/beat konteyneri ayakta mı; Redis URL doğru mu.

## 4) Kurtarma / Rollback
- Hızlı rollback: önceki imaj tag’ine dön (`docker-compose pull && up -d`).
- Migrasyon kaynaklı sorun: bakım modunda eski DB snapshot’a dön; uzun migration öncesi backup şart.
- Statik/asset sorunu: frontend build’i tekrar yayınla (`npm run build && npm run preview` imajı).

## 5) Veri / Backup
- Postgres: pg_dump custom dosyası, `deploy/restore.sh` ile geri yükleme.
- Media/static: yedek arşivden geri dön.

## 6) Güvenlik / Erişim
- Admin brute-force / throttle: login throttle env (THROTTLE_LOGIN) artır/izle.
- Şüpheli erişim: audit log’ları ve access log’ları incele; token iptali gerekirse refresh token rotation uygulayın.

## 7) İletişim
- Durum güncellemesi: P0/1 için 30 dk aralıklarla, P2/3 için 60 dk.
- Kapanış: kök neden, etki, çözüm, önleyici aksiyon listesi.

