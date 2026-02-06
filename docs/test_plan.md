# Test Plan (Kısa)

## Backend
- Auth: login/refresh, 2FA (OTP verify + fallback), password reset/confirm, change-password.
- RBAC: Admin/Manager/Worker erişim kısıtları; role-perms API (GET/POST).
- Tasks: create/update/delete, date validations (end >= start, due >= start), upload size/type limit, attachment versioning.
- Automation: triggers (task_status_changed, task_due_soon), actions (add_comment, set_assignee, add_tag, set_field, notify, multi_notify); hata durumunda log kaydı.
- Presign: /uploads/presign tip/boyut doğrulaması, presigned POST döndüğü zaman S3/MinIO upload testi.
- Global search: page/limit paramları, type/tags filtre, cache TTL doğrulama.
- Health: /health db/redis.

## Frontend
- Login + 2FA akışı (OTP zorunluysa).
- Settings: şifre değiştir, bildirim prefs kaydet, health kartı yenile.
- Tasks: oluştur/güncelle/sil; tarih validasyonu hatalarını inline gör; dosya yükleme tip/boyut kontrolü; drag-drop.
- Global arama: q/tags/type, page/limit; “sonraki/önceki” ile sayfa değişimi; kayıtlı arama yükleme.
- Otomasyon formu: trigger/action seçimleri, JSON payload girişleri; test/dry-run.
- UI: dropdown/responsive kontroller (tasks tablosu overflow-x, mobil menü).

## E2E (öneri)
- Login (+OTP) → görev oluştur → durum değiştir → otomasyon notify tetikler → SSE toast gör.
- Şifre reset (email stub) → confirm → yeni şifre ile login.
- Presigned upload → S3/MinIO’ya yükle → görev ekinde görünür.
- Global search paginasyon → sayfa ileri/geri sonuçları güncelleniyor.

## Güvenlik Taramaları
- bandit (backend), npm audit/pip-audit, trivy (imaj).

## Performans Basit
- Liste/search endpointlerine eşzamanlı 50-100 istek; latency ve 5xx kontrolü.

