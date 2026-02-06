# Ürünleştirme (Prod Hazırlık) Tam Liste

## 1) Güvenlik / Kimlik
- [ ] Şifre sıfırlama (mail token) ve zorunlu parola politikası (min uzunluk, karmaşık karakter).
- [ ] Opsiyonel 2FA (TOTP) veya en azından login rate-limit (IP/hesap bazlı).
- [ ] Oturum süresi ve refresh akışı: access kısa, refresh uzun; otomatik token yenileme; logout tüm oturumları kapat.
- [ ] RBAC: view-only/comment-only var; alan bazlı yetki ve ek/yorum silme politikalarını UI’den yönetilebilir kıl.
- [ ] Audit log: kritik nesneler (user, permission, role, integration) için eksiksiz; erişim logu (kim, ne zaman, hangi IP).
- [ ] API throttling (login, search, file upload) için limitleri UI’den okunabilir/konfigüre edilebilir kıl.
- [ ] Veri gizliliği/uyum: PII maskeleme, retention/purge politikası, gizlilik bildirimi.

## 2) Depolama / Dosya
- [ ] S3/MinIO presign: gerçek creds ile uçtan uca test; max size/type sınırı ve virüs tarama (opsiyonel) ekle.
- [ ] Ek meta/etiket/versiyon akışını doğrula; rename/sil yetki kontrolü ve UI akışı.

## 3) Veri Bütünlüğü / Validasyon
- [ ] TS “@ts-nocheck” kalan dosyaları tip güvenli hale getir (tasks, crm vb.).
- [ ] Tüm formlarda backend hatalarını inline gösterme (SKU/email benzersizliği, tarih aralığı vb.) doğrulanmış olsun.
- [ ] Migrations tutarlılığı; demo seed dev’de açık, prod’da kapalı; test seed ayrı.
- [ ] API rate-limit ve pagination zorunlu (liste ve search).
- [ ] Deployment-safe migration rehberi: long-running migrationlar için bakım modu/lock stratejisi.

## 4) Performans / UX
- [ ] Liste/arama uçlarında pagination + limit (zorunlu).
- [ ] Dashboard/arama için server-side caching (Redis) + TTL (yazılımsal).
- [ ] Responsive kontroller: görevler/raporlar vs. overflow; küçük ekran grid/scroll doğrulaması.
- [ ] Global search için sayfa/limit paramları; sonuç sayısı gösterimi mevcut, paginasyon ekle.
- [ ] İstemci hata/boş durum mesajları: kritik akışlarda kullanıcıya yönlendiren, aksiyonlu uyarılar.

## 5) Bildirim / Otomasyon
- [ ] SMTP ve Slack webhook değerleriyle uçtan uca test (uygulama düzeyi).
- [ ] Otomasyon kütüphanesi: UI’de yardım ve test/dry-run butonu var; kural yürütme logu ve hata yakalama ekle.
- [ ] SLA uyarıları (Celery beat) uygulamada doğrula; mail/Slack entegrasyonunu test et.
- [ ] SSE/WS: token’lı bağlantı ve yeniden bağlanma doğrulaması.

## 6) Ürünleşme / UX
- [ ] Demo filigranı/rol switcher gibi “demo” özelliklerini prod’da kapat.
- [ ] Kullanıcı davet/aktivasyon akışı; e-posta doğrulama.
- [ ] Şifre değiştirme “me” uç noktası ve UI.
- [ ] Erişilebilirlik: fokus durumları, klavye navigasyonu; TR/EN locale seçimi (ayar).

## 7) Test / Kalite
- [ ] Backend: auth, permissions, otomasyon, SLA cron, upload için temel testler (pytest).
- [ ] Frontend: smoke/E2E (login, görev oluşturma, arama).
- [ ] Load test (basit): liste/search endpoint’leri için.
- [ ] Güvenlik testleri: statik analiz (bandit/trivy), bağımlılık taraması (npm/yarn audit, pip-audit).

## 8) Dokümantasyon
- [ ] Kullanıcı dokümantasyonu: roller, izinler, upload sınırları, otomasyon kullanım rehberi.
- [ ] Incident runbook: sık görülen hatalar, log/metric bakış noktaları, müdahale adımları.


