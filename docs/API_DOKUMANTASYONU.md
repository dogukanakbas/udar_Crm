# Udar CRM + ERP API Dokumantasyonu

_Olusturma tarihi: 2026-04-30 15:41_

Bu dokuman mevcut Django REST API/OpenAPI semasindan ve kod icindeki ozel aksiyonlardan hazirlanmistir. Mobil uygulama gelistirme, web entegrasyonu ve ucuncu parti servis baglantilari icin referans olarak kullanilabilir.


## Genel Kurallar

### Base URL
- Lokal gelistirme: `http://localhost:8000/api`
- Production ornegi: `https://api.udarsoft.com/api`
- Public website endpointleri ayni base altinda `/v1/...` prefixi kullanir.

### Authentication
Yetkili endpointlerde JWT Bearer token gerekir.

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Dosya yukleme endpointlerinde `multipart/form-data` kullanilir; browser/mobile client boundary bilgisini kendisi uretmelidir.

### Organizasyon izolasyonu
Cogu CRUD endpoint `request.user.organization` ile otomatik filtrelenir. Mobil uygulama organizasyon id gondermemeli; backend kullanicinin organizasyonundan scoped veri dondurur.

### Ortak liste parametreleri
DRF viewset list endpointlerinin cogu asagidaki parametreleri destekler:

| Parametre | Kullanim | Ornek |
|---|---|---|
| `search` | Tanimli `search_fields` icinde arama | `/api/tasks/?search=kapi` |
| `ordering` | Siralama; basina `-` gelirse azalan | `/api/quotes/?ordering=-created_at` |
| endpoint ozel filtreleri | Bazi endpointlerde ek query paramlari vardir | `/api/quotes/?document_type=Contract` |

### Tarih ve sayi formati
- Tarihler cogunlukla ISO-8601 (`2026-04-30`, `2026-04-30T14:31:00+03:00`) formatindadir.
- Decimal alanlar JSON'da string olarak donebilir (`"1200.00"`). Mobilde para hesaplari icin float yerine decimal kullanilmali.
- Para birimi kodlari: `TRY`, `USD`, `EUR`; gorsel semboller UI katmaninda `TL`, `$`, `EUR` olarak gosterilebilir.

### Dosya indirme
- `responseType=blob` / native stream kullanilmali.
- `Content-Disposition` filename degeri varsa onu kullanin.
- Teklif/sozlesme PDF dosya adi backend/frontend tarafinda belge numarasidir: `OR-S-2604301431.pdf`.


## Ortak HTTP Durum Kodlari

| Kod | Anlam | Mobil Davranis |
|---|---|---|
| `200` | Basarili okuma/guncelleme | Ekrani guncelle. |
| `201` | Kayit olusturuldu | Yeni kaydi cache/listeye ekle. |
| `204` | Silme basarili, body yok | Listeden kaldir. |
| `400` | Validasyon veya is kurali hatasi | `detail`, `error` veya field hatasini kullaniciya goster. |
| `401` | Token yok/gecersiz | Refresh dene, olmazsa login. |
| `403` | Yetki yok | Yetkisiz erisim mesaji goster; butonu gizlemek icin permissions cache kullan. |
| `404` | Kayit yok veya organizasyon disinda | Listeyi yenile, detay ekranindan cik. |
| `429` | Rate limit | Login/contact gibi endpointlerde bekleme mesaji goster. |
| `500` | Sunucu hatasi | Genel hata mesaji + log. |


## Mobil Uygulama Icin Temel Akislar

### 1. Login ve oturum yenileme
1. `POST /api/auth/login/` ile `access` ve `refresh` token alinir.
2. Her yetkili API isteginde `Authorization: Bearer <access>` header gonderilir.
3. `401 Unauthorized` alinirsa `POST /api/auth/refresh/` ile access token yenilenir.
4. Refresh de basarisizsa kullanici login ekranina gonderilir.
5. Uygulama ilk acilisinda `GET /api/auth/me/`, `GET /api/auth/organization-settings/`, `GET /api/auth/users/`, `GET /api/teams/` cagrilari cache'e alinabilir.

### 2. Teklif olusturma ve sozlesmeye donusturme
1. Cari listesi icin `GET /api/partners/` cagrilir.
2. Satici firma icin `GET /api/seller-companies/` cagrilir.
3. Urunler ve kategori/urun gruplari icin `GET /api/products/`, `GET /api/categories/` cagrilir.
4. `POST /api/quotes/` ile `document_type=Quote` gonderilir. Belge no backend tarafindan otomatik uretilir.
5. Teklif olumlu donerse `POST /api/quotes/{id}/convert/` cagrilir. Backend ayni satirlari sozlesmeye kopyalar ve yeni `Contract` uretir.
6. PDF indirme icin `GET /api/quotes/{id}/export-pdf/` kullanilir.

### 3. Gorev ve uretim akisi
1. Gorev listesi `GET /api/tasks/` ile alinir; `search`, `ordering` desteklenir.
2. Gorev olusturma `POST /api/tasks/` ile yapilir. Worker rolu gorev olusturamaz.
3. Is akisi ekipleri varsa checklist otomatik senkronize edilir.
4. Gorev ustlenme, birakma, sonraki asamaya gecme gibi ozel aksiyonlar endpoint detaylarinda listelenmistir.
5. Dosya yukleme icin once `POST /api/uploads/presign/`, sonra donen stratejiye gore upload yapilir.

### 4. Canli bildirimler
1. Web su an `GET /api/stream/?token=<access>` SSE kullanir.
2. Mobilde SSE kullanilabilir; ancak arka planda guvenilir bildirim icin ayrica FCM/APNs cihaz token API'si onerilir.
3. Event payloadlari genel olarak `{type, organization, task_id, quote_id, ...}` seklindedir.


## API'ye Cevrilmesi Onerilen veya Mobil Icin Tamamlanmasi Gereken Noktalar

| Alan | Mevcut Durum | Mobil Icin Oneri |
|---|---|---|
| CRM/teklif/gorev CSV export | Bazi CSV exportlar frontend icinde `Blob` ile uretiliyor. | Mobil de ayni ciktiyi istiyorsa backend export endpointi eklenmeli. |
| Sirket XLSX export | `src/lib/company-export-xlsx.ts` client-side calisiyor. | `GET /api/partners/export/` gibi filtre destekli backend XLSX/PDF endpointi eklenmeli. |
| Stok XLSX sablon indir/disa aktar | `src/lib/inventory-bulk-xlsx.ts` client-side XLSX uretiyor; JSON bulk-upsert API var. | Mobil icin server-side `products/export-template`, `products/export-current`, `products/import-xlsx` endpointleri daha dogru olur. |
| Kullanici arayuz tercihleri | Tema, tablo filtreleri, gorev gorunum secenekleri localStorage'da. | Cross-device deneyim icin `GET/PATCH /api/auth/preferences/` benzeri kullanici tercih API'si eklenebilir. |
| Push notification | SSE var, mobil push token kaydi yok. | `POST /api/devices/` ve `DELETE /api/devices/{id}/` ile FCM/APNs token yonetimi eklenmeli. |
| Offline kullanim | API online-first. | Mobil icin sync timestamp, delta endpointleri ve conflict stratejisi eklenebilir. |
| Sablon PDF onizleme | PDF export var, ama template preview ayri endpoint degil. | Mobil/admin icin `POST /api/quotes/template-preview/` dusunulebilir. |
| Legacy local mock DB | `src/lib/mockDb.ts` eski/local demo davranislari iceriyor. | Mobil uygulama sadece gercek API'ye baglanmali; mock veri ayri dev modunda tutulmali. |

## Endpoint Grup Ozeti

| Grup | Operation Sayisi | Ana Kullanim |
|---|---:|---|
| Onay ve Denetim | 6 | Teklif onay akisi ve audit log. |
| Auth ve Kullanici | 23 | Login, token refresh, kullanici/rol/izin, 2FA, organizasyon ayarlari. |
| Gorev, Destek, Dosya, Otomasyon | 72 | Gorev uretim akisi, ticket, yorum, ek, checklist, zaman ve otomasyon. |
| Dashboard, Arama, Saglik, SSE | 4 | KPI, global arama, canli event stream, takvim export, health check. |
| ERP: Stok, Urun, Siparis, Fatura, Lojistik | 44 | Urun, kategori, stok, siparis, fatura, arac yonetimi. |
| CRM: Cari, Lead, Firsat, Kisi | 24 | CRM ana verileri ve musteri iliskileri. |
| Teklif / Sozlesme / Satici Firma / Sablon | 32 | Belge olusturma, PDF/Excel export, satici firma ve sablon yonetimi. |
| Ekipler | 12 | Ekip ve hesapsiz calisan yonetimi. |
| Public Website ve SaaS Admin | 35 | Blog, contact form, tenant/plan/subscription admin API. |

## Onay ve Denetim

| Method | Endpoint | Islev | Request Body | Basarili/Onemli Response |
|---|---|---|---|---|
| `GET` | `/api/approvals/` | approvals_list | - | `200` application/json: Array<ApprovalInstance> |
| `GET` | `/api/approvals/pending/` | approvals_pending_retrieve | - | `200` No response body |
| `POST` | `/api/approvals/step/{id}/action/` | approvals_step_action_create | - | `200` No response body |
| `GET` | `/api/approvals/{id}/` | approvals_retrieve | - | `200` application/json: ApprovalInstance |
| `GET` | `/api/audit/` | audit_list | - | `200` application/json: Array<AuditLog> |
| `GET` | `/api/audit/{id}/` | audit_retrieve | - | `200` application/json: AuditLog |

## Auth ve Kullanici

| Method | Endpoint | Islev | Request Body | Basarili/Onemli Response |
|---|---|---|---|---|
| `POST` | `/api/auth/activate/` | auth_activate_create | - | `200` No response body |
| `POST` | `/api/auth/bulk-create-users/` | Admin: Her satir 'Ad Soyad' - benzersiz kullanici adi ve sifre uretilir (e-posta zorunlu degil). | - | `200` No response body |
| `POST` | `/api/auth/change-password/` | auth_change_password_create | - | `200` No response body |
| `POST` | `/api/auth/create-user/` | auth_create_user_create | - | `200` No response body |
| `POST` | `/api/auth/invite/` | auth_invite_create | - | `200` No response body |
| `POST` | `/api/auth/login/` | JWT access/refresh token alir. Body: username/password, 2FA aciksa otp gerekebilir. | `application/json`: `TwoFATokenObtainPair`<br>`application/x-www-form-urlencoded`: `TwoFATokenObtainPair`<br>`multipart/form-data`: `TwoFATokenObtainPair` zorunlu | `200` application/json: TwoFATokenObtainPair |
| `GET` | `/api/auth/me/` | Mobil uygulama acilisinda aktif kullanici, rol ve organizasyon bilgisini alir. | - | `200` No response body |
| `GET` | `/api/auth/notification-prefs/` | auth_notification_prefs_retrieve | - | `200` No response body |
| `POST` | `/api/auth/notification-prefs/` | auth_notification_prefs_create | - | `200` No response body |
| `GET` | `/api/auth/organization-settings/` | auth_organization_settings_retrieve | - | `200` No response body |
| `PATCH` | `/api/auth/organization-settings/` | auth_organization_settings_partial_update | - | `200` No response body |
| `POST` | `/api/auth/otp/disable/` | auth_otp_disable_create | - | `200` No response body |
| `POST` | `/api/auth/otp/enable/` | auth_otp_enable_create | - | `200` No response body |
| `POST` | `/api/auth/otp/setup/` | auth_otp_setup_create | - | `200` No response body |
| `POST` | `/api/auth/password-reset/` | auth_password_reset_create | - | `200` No response body |
| `POST` | `/api/auth/password-reset/confirm/` | auth_password_reset_confirm_create | - | `200` No response body |
| `GET` | `/api/auth/permissions/` | auth_permissions_retrieve | - | `200` No response body |
| `POST` | `/api/auth/refresh/` | Refresh token ile yeni access token uretir. | `application/json`: `TokenRefresh`<br>`application/x-www-form-urlencoded`: `TokenRefresh`<br>`multipart/form-data`: `TokenRefresh` zorunlu | `200` application/json: TokenRefresh |
| `GET` | `/api/auth/role-perms/` | auth_role_perms_retrieve | - | `200` No response body |
| `POST` | `/api/auth/role-perms/` | auth_role_perms_create | - | `200` No response body |
| `GET` | `/api/auth/users/` | auth_users_retrieve | - | `200` No response body |
| `PATCH` | `/api/auth/users/{id}/` | Admin: organizasyondaki kullaniciyi kalici siler (FK'ler SET_NULL ise guvenli). | - | `200` No response body |
| `DELETE` | `/api/auth/users/{id}/` | Admin: organizasyondaki kullaniciyi kalici siler (FK'ler SET_NULL ise guvenli). | - | `204` No response body |

## Gorev, Destek, Dosya, Otomasyon

| Method | Endpoint | Islev | Request Body | Basarili/Onemli Response |
|---|---|---|---|---|
| `GET` | `/api/automation-rules/` | automation_rules_list | - | `200` application/json: Array<AutomationRule> |
| `POST` | `/api/automation-rules/` | automation_rules_create | `application/json`: `AutomationRule`<br>`application/x-www-form-urlencoded`: `AutomationRule`<br>`multipart/form-data`: `AutomationRule` zorunlu | `201` application/json: AutomationRule |
| `GET` | `/api/automation-rules/help/` | automation_rules_help_retrieve | - | `200` application/json: AutomationRule |
| `POST` | `/api/automation-rules/test/` | Dry-run automation: evaluates condition and returns would-be actions without side effects. Body: {trigger, condition, action, action_payload, sample_task: {...}, extra: {...}} | `application/json`: `AutomationRule`<br>`application/x-www-form-urlencoded`: `AutomationRule`<br>`multipart/form-data`: `AutomationRule` zorunlu | `200` application/json: AutomationRule |
| `GET` | `/api/automation-rules/{id}/` | automation_rules_retrieve | - | `200` application/json: AutomationRule |
| `PUT` | `/api/automation-rules/{id}/` | automation_rules_update | `application/json`: `AutomationRule`<br>`application/x-www-form-urlencoded`: `AutomationRule`<br>`multipart/form-data`: `AutomationRule` zorunlu | `200` application/json: AutomationRule |
| `PATCH` | `/api/automation-rules/{id}/` | automation_rules_partial_update | `application/json`: `PatchedAutomationRule`<br>`application/x-www-form-urlencoded`: `PatchedAutomationRule`<br>`multipart/form-data`: `PatchedAutomationRule` | `200` application/json: AutomationRule |
| `DELETE` | `/api/automation-rules/{id}/` | automation_rules_destroy | - | `204` No response body |
| `GET` | `/api/task-attachments/` | task_attachments_list | - | `200` application/json: Array<TaskAttachment> |
| `POST` | `/api/task-attachments/` | task_attachments_create | `application/json`: `TaskAttachment`<br>`application/x-www-form-urlencoded`: `TaskAttachment`<br>`multipart/form-data`: `TaskAttachment` zorunlu | `201` application/json: TaskAttachment |
| `GET` | `/api/task-attachments/{id}/` | task_attachments_retrieve | - | `200` application/json: TaskAttachment |
| `PUT` | `/api/task-attachments/{id}/` | task_attachments_update | `application/json`: `TaskAttachment`<br>`application/x-www-form-urlencoded`: `TaskAttachment`<br>`multipart/form-data`: `TaskAttachment` zorunlu | `200` application/json: TaskAttachment |
| `PATCH` | `/api/task-attachments/{id}/` | task_attachments_partial_update | `application/json`: `PatchedTaskAttachment`<br>`application/x-www-form-urlencoded`: `PatchedTaskAttachment`<br>`multipart/form-data`: `PatchedTaskAttachment` | `200` application/json: TaskAttachment |
| `DELETE` | `/api/task-attachments/{id}/` | task_attachments_destroy | - | `204` No response body |
| `GET` | `/api/task-checklist/` | task_checklist_list | - | `200` application/json: Array<TaskChecklist> |
| `POST` | `/api/task-checklist/` | task_checklist_create | `application/json`: `TaskChecklist`<br>`application/x-www-form-urlencoded`: `TaskChecklist`<br>`multipart/form-data`: `TaskChecklist` zorunlu | `201` application/json: TaskChecklist |
| `POST` | `/api/task-checklist/reorder/` | Sira guncelle: { "task": "<task_id>", "order": ["<id1>", "<id2>", ...] } | `application/json`: `TaskChecklist`<br>`application/x-www-form-urlencoded`: `TaskChecklist`<br>`multipart/form-data`: `TaskChecklist` zorunlu | `200` application/json: TaskChecklist |
| `GET` | `/api/task-checklist/{id}/` | task_checklist_retrieve | - | `200` application/json: TaskChecklist |
| `PUT` | `/api/task-checklist/{id}/` | task_checklist_update | `application/json`: `TaskChecklist`<br>`application/x-www-form-urlencoded`: `TaskChecklist`<br>`multipart/form-data`: `TaskChecklist` zorunlu | `200` application/json: TaskChecklist |
| `PATCH` | `/api/task-checklist/{id}/` | task_checklist_partial_update | `application/json`: `PatchedTaskChecklist`<br>`application/x-www-form-urlencoded`: `PatchedTaskChecklist`<br>`multipart/form-data`: `PatchedTaskChecklist` | `200` application/json: TaskChecklist |
| `DELETE` | `/api/task-checklist/{id}/` | task_checklist_destroy | - | `204` No response body |
| `GET` | `/api/task-comments/` | task_comments_list | - | `200` application/json: Array<TaskComment> |
| `POST` | `/api/task-comments/` | task_comments_create | `application/json`: `TaskComment`<br>`application/x-www-form-urlencoded`: `TaskComment`<br>`multipart/form-data`: `TaskComment` zorunlu | `201` application/json: TaskComment |
| `GET` | `/api/task-comments/{id}/` | task_comments_retrieve | - | `200` application/json: TaskComment |
| `PUT` | `/api/task-comments/{id}/` | task_comments_update | `application/json`: `TaskComment`<br>`application/x-www-form-urlencoded`: `TaskComment`<br>`multipart/form-data`: `TaskComment` zorunlu | `200` application/json: TaskComment |
| `PATCH` | `/api/task-comments/{id}/` | task_comments_partial_update | `application/json`: `PatchedTaskComment`<br>`application/x-www-form-urlencoded`: `PatchedTaskComment`<br>`multipart/form-data`: `PatchedTaskComment` | `200` application/json: TaskComment |
| `DELETE` | `/api/task-comments/{id}/` | task_comments_destroy | - | `204` No response body |
| `GET` | `/api/task-models/` | Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir. | - | `200` application/json: Array<TaskModel> |
| `POST` | `/api/task-models/` | Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir. | `application/json`: `TaskModel`<br>`application/x-www-form-urlencoded`: `TaskModel`<br>`multipart/form-data`: `TaskModel` zorunlu | `201` application/json: TaskModel |
| `GET` | `/api/task-models/{id}/` | Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir. | - | `200` application/json: TaskModel |
| `PUT` | `/api/task-models/{id}/` | Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir. | `application/json`: `TaskModel`<br>`application/x-www-form-urlencoded`: `TaskModel`<br>`multipart/form-data`: `TaskModel` zorunlu | `200` application/json: TaskModel |
| `PATCH` | `/api/task-models/{id}/` | Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir. | `application/json`: `PatchedTaskModel`<br>`application/x-www-form-urlencoded`: `PatchedTaskModel`<br>`multipart/form-data`: `PatchedTaskModel` | `200` application/json: TaskModel |
| `DELETE` | `/api/task-models/{id}/` | Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir. | - | `204` No response body |
| `GET` | `/api/task-reports/export/` | Gorev raporunu xlsx/docx olarak indirir. | - | `200` No response body |
| `GET` | `/api/task-reports/summary/` | task_reports_summary_retrieve | - | `200` No response body |
| `GET` | `/api/task-time-entries/` | task_time_entries_list | - | `200` application/json: Array<TaskTimeEntry> |
| `POST` | `/api/task-time-entries/` | task_time_entries_create | `application/json`: `TaskTimeEntry`<br>`application/x-www-form-urlencoded`: `TaskTimeEntry`<br>`multipart/form-data`: `TaskTimeEntry` zorunlu | `201` application/json: TaskTimeEntry |
| `GET` | `/api/task-time-entries/{id}/` | task_time_entries_retrieve | - | `200` application/json: TaskTimeEntry |
| `PUT` | `/api/task-time-entries/{id}/` | task_time_entries_update | `application/json`: `TaskTimeEntry`<br>`application/x-www-form-urlencoded`: `TaskTimeEntry`<br>`multipart/form-data`: `TaskTimeEntry` zorunlu | `200` application/json: TaskTimeEntry |
| `PATCH` | `/api/task-time-entries/{id}/` | task_time_entries_partial_update | `application/json`: `PatchedTaskTimeEntry`<br>`application/x-www-form-urlencoded`: `PatchedTaskTimeEntry`<br>`multipart/form-data`: `PatchedTaskTimeEntry` | `200` application/json: TaskTimeEntry |
| `DELETE` | `/api/task-time-entries/{id}/` | task_time_entries_destroy | - | `204` No response body |
| `GET` | `/api/tasks/` | tasks_list | - | `200` application/json: Array<Task> |
| `POST` | `/api/tasks/` | tasks_create | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `201` application/json: Task |
| `POST` | `/api/tasks/import-excel/` | Gorev uretim Excel dosyasini ice aktarir. | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `200` application/json: Task |
| `GET` | `/api/tasks/my-team-queue/` | Worker icin: sirali akista yalnizca ilgili ekip usta basisi (havuzdaki gorevler); paralel akista ilgili bolum uyeleri. Liste sonunda kullaniciya gore filtrelenir. | - | `200` application/json: Task |
| `GET` | `/api/tasks/production-report/` | Gunluk uretim: ?date=YYYY-MM-DD (yonetici) | - | `200` application/json: Task |
| `GET` | `/api/tasks/worker-detail/` | Calisan detay: gunluk/aylik sure, aktif/biten gorevler. Query: ?worker_id=123 | - | `200` application/json: Task |
| `GET` | `/api/tasks/worker-tracking/` | Admin/Manager icin worker tracking endpoint'i. Her worker'in hangi departmanda calistigini gosterir. | - | `200` application/json: Task |
| `GET` | `/api/tasks/{id}/` | tasks_retrieve | - | `200` application/json: Task |
| `PUT` | `/api/tasks/{id}/` | tasks_update | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `200` application/json: Task |
| `PATCH` | `/api/tasks/{id}/` | tasks_partial_update | `application/json`: `PatchedTask`<br>`application/x-www-form-urlencoded`: `PatchedTask`<br>`multipart/form-data`: `PatchedTask` | `200` application/json: Task |
| `DELETE` | `/api/tasks/{id}/` | tasks_destroy | - | `204` No response body |
| `POST` | `/api/tasks/{id}/approve-section/` | Usta basi / yonetici: paralel akista bolum onayi (tum bolumler bitince done); sirali akista onay sonrasi siradaki ekibe devir veya gorevin kapanmasi. | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `200` application/json: Task |
| `POST` | `/api/tasks/{id}/claim/` | Worker ekibindeki bekleyen gorevi ustlenir. Paralel akista workflow icindeki uygun bolumde ustlenir. | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `200` application/json: Task |
| `POST` | `/api/tasks/{id}/complete-stage/` | Paralel akis: aktif ekipte bolum tamamlaninca otomatik olarak siradaki ekibe gecer. Sirali is akisi (workflow_team_ids, workflow_parallel kapali): ekip uyesi bitir ile onaya gonderir; usta basi approve_section ile siradaki ekibe devreder veya gorevi kapatir. Is akisi tanimsizsa fabrika sirasi ile devretme / tamamlama (onceki davranis). | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `200` application/json: Task |
| `POST` | `/api/tasks/{id}/handover/` | tasks_handover_create | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `200` application/json: Task |
| `POST` | `/api/tasks/{id}/log-production/` | Gunluk tamamlanan adet - istege bagli siparise quantity_produced yansir. | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `200` application/json: Task |
| `POST` | `/api/tasks/{id}/release-to-team/` | Usta basi: gorevi ekibe acar (assignee temizlenir, uyeler ustlenebilir). | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `200` application/json: Task |
| `POST` | `/api/tasks/{id}/self_handover/` | Worker kendi gorevini baska ekibe devredebilir (bolum degisimi icin) | `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu | `200` application/json: Task |
| `GET` | `/api/ticket-messages/` | ticket_messages_list | - | `200` application/json: Array<TicketMessage> |
| `POST` | `/api/ticket-messages/` | ticket_messages_create | `application/json`: `TicketMessage`<br>`application/x-www-form-urlencoded`: `TicketMessage`<br>`multipart/form-data`: `TicketMessage` zorunlu | `201` application/json: TicketMessage |
| `GET` | `/api/ticket-messages/{id}/` | ticket_messages_retrieve | - | `200` application/json: TicketMessage |
| `PUT` | `/api/ticket-messages/{id}/` | ticket_messages_update | `application/json`: `TicketMessage`<br>`application/x-www-form-urlencoded`: `TicketMessage`<br>`multipart/form-data`: `TicketMessage` zorunlu | `200` application/json: TicketMessage |
| `PATCH` | `/api/ticket-messages/{id}/` | ticket_messages_partial_update | `application/json`: `PatchedTicketMessage`<br>`application/x-www-form-urlencoded`: `PatchedTicketMessage`<br>`multipart/form-data`: `PatchedTicketMessage` | `200` application/json: TicketMessage |
| `DELETE` | `/api/ticket-messages/{id}/` | ticket_messages_destroy | - | `204` No response body |
| `GET` | `/api/tickets/` | tickets_list | - | `200` application/json: Array<Ticket> |
| `POST` | `/api/tickets/` | tickets_create | `application/json`: `Ticket`<br>`application/x-www-form-urlencoded`: `Ticket`<br>`multipart/form-data`: `Ticket` zorunlu | `201` application/json: Ticket |
| `GET` | `/api/tickets/{id}/` | tickets_retrieve | - | `200` application/json: Ticket |
| `PUT` | `/api/tickets/{id}/` | tickets_update | `application/json`: `Ticket`<br>`application/x-www-form-urlencoded`: `Ticket`<br>`multipart/form-data`: `Ticket` zorunlu | `200` application/json: Ticket |
| `PATCH` | `/api/tickets/{id}/` | tickets_partial_update | `application/json`: `PatchedTicket`<br>`application/x-www-form-urlencoded`: `PatchedTicket`<br>`multipart/form-data`: `PatchedTicket` | `200` application/json: Ticket |
| `DELETE` | `/api/tickets/{id}/` | tickets_destroy | - | `204` No response body |
| `POST` | `/api/uploads/presign/` | Mobil/web dosya yukleme icin upload stratejisi dondurur; direct/S3/MinIO destekler. | - | `200` No response body |

## Dashboard, Arama, Saglik, SSE

| Method | Endpoint | Islev | Request Body | Basarili/Onemli Response |
|---|---|---|---|---|
| `GET` | `/api/calendar/ics/` | calendar_ics_retrieve | - | `200` No response body |
| `GET` | `/api/dashboard/kpis/` | dashboard_kpis_retrieve | - | `200` No response body |
| `GET` | `/api/search/` | search_retrieve | - | `200` No response body |
| `GET` | `/api/stream/` | SSE canli olay akisi. EventSource header tasiyamadigi icin token query param ile gonderilir. | - | `200` No response body |

## ERP: Stok, Urun, Siparis, Fatura, Lojistik

| Method | Endpoint | Islev | Request Body | Basarili/Onemli Response |
|---|---|---|---|---|
| `GET` | `/api/categories/` | categories_list | - | `200` application/json: Array<Category> |
| `POST` | `/api/categories/` | categories_create | `application/json`: `Category`<br>`application/x-www-form-urlencoded`: `Category`<br>`multipart/form-data`: `Category` | `201` application/json: Category |
| `GET` | `/api/categories/{id}/` | categories_retrieve | - | `200` application/json: Category |
| `PUT` | `/api/categories/{id}/` | categories_update | `application/json`: `Category`<br>`application/x-www-form-urlencoded`: `Category`<br>`multipart/form-data`: `Category` | `200` application/json: Category |
| `PATCH` | `/api/categories/{id}/` | categories_partial_update | `application/json`: `PatchedCategory`<br>`application/x-www-form-urlencoded`: `PatchedCategory`<br>`multipart/form-data`: `PatchedCategory` | `200` application/json: Category |
| `DELETE` | `/api/categories/{id}/` | categories_destroy | - | `204` No response body |
| `GET` | `/api/invoices/` | invoices_list | - | `200` application/json: Array<Invoice> |
| `POST` | `/api/invoices/` | invoices_create | `application/json`: `Invoice`<br>`application/x-www-form-urlencoded`: `Invoice`<br>`multipart/form-data`: `Invoice` zorunlu | `201` application/json: Invoice |
| `GET` | `/api/invoices/{id}/` | invoices_retrieve | - | `200` application/json: Invoice |
| `PUT` | `/api/invoices/{id}/` | invoices_update | `application/json`: `Invoice`<br>`application/x-www-form-urlencoded`: `Invoice`<br>`multipart/form-data`: `Invoice` zorunlu | `200` application/json: Invoice |
| `PATCH` | `/api/invoices/{id}/` | invoices_partial_update | `application/json`: `PatchedInvoice`<br>`application/x-www-form-urlencoded`: `PatchedInvoice`<br>`multipart/form-data`: `PatchedInvoice` | `200` application/json: Invoice |
| `DELETE` | `/api/invoices/{id}/` | invoices_destroy | - | `204` No response body |
| `GET` | `/api/products/` | products_list | - | `200` application/json: Array<Product> |
| `POST` | `/api/products/` | products_create | `application/json`: `Product`<br>`application/x-www-form-urlencoded`: `Product`<br>`multipart/form-data`: `Product` | `201` application/json: Product |
| `POST` | `/api/products/bulk-upsert/` | Toplu urun/kategori senkronizasyonu icin JSON API. | `application/json`: `Product`<br>`application/x-www-form-urlencoded`: `Product`<br>`multipart/form-data`: `Product` | `200` application/json: Product |
| `POST` | `/api/products/import-template-catalog/` | Sistem sablon urun katalogunu stok tarafina aktarir. | `application/json`: `Product`<br>`application/x-www-form-urlencoded`: `Product`<br>`multipart/form-data`: `Product` | `200` application/json: Product |
| `GET` | `/api/products/{id}/` | products_retrieve | - | `200` application/json: Product |
| `PUT` | `/api/products/{id}/` | products_update | `application/json`: `Product`<br>`application/x-www-form-urlencoded`: `Product`<br>`multipart/form-data`: `Product` | `200` application/json: Product |
| `PATCH` | `/api/products/{id}/` | products_partial_update | `application/json`: `PatchedProduct`<br>`application/x-www-form-urlencoded`: `PatchedProduct`<br>`multipart/form-data`: `PatchedProduct` | `200` application/json: Product |
| `DELETE` | `/api/products/{id}/` | products_destroy | - | `204` No response body |
| `GET` | `/api/purchase-orders/` | purchase_orders_list | - | `200` application/json: Array<PurchaseOrder> |
| `POST` | `/api/purchase-orders/` | purchase_orders_create | `application/json`: `PurchaseOrder`<br>`application/x-www-form-urlencoded`: `PurchaseOrder`<br>`multipart/form-data`: `PurchaseOrder` zorunlu | `201` application/json: PurchaseOrder |
| `GET` | `/api/purchase-orders/{id}/` | purchase_orders_retrieve | - | `200` application/json: PurchaseOrder |
| `PUT` | `/api/purchase-orders/{id}/` | purchase_orders_update | `application/json`: `PurchaseOrder`<br>`application/x-www-form-urlencoded`: `PurchaseOrder`<br>`multipart/form-data`: `PurchaseOrder` zorunlu | `200` application/json: PurchaseOrder |
| `PATCH` | `/api/purchase-orders/{id}/` | purchase_orders_partial_update | `application/json`: `PatchedPurchaseOrder`<br>`application/x-www-form-urlencoded`: `PatchedPurchaseOrder`<br>`multipart/form-data`: `PatchedPurchaseOrder` | `200` application/json: PurchaseOrder |
| `DELETE` | `/api/purchase-orders/{id}/` | purchase_orders_destroy | - | `204` No response body |
| `GET` | `/api/sales-orders/` | sales_orders_list | - | `200` application/json: Array<SalesOrder> |
| `POST` | `/api/sales-orders/` | sales_orders_create | `application/json`: `SalesOrder`<br>`application/x-www-form-urlencoded`: `SalesOrder`<br>`multipart/form-data`: `SalesOrder` zorunlu | `201` application/json: SalesOrder |
| `GET` | `/api/sales-orders/{id}/` | sales_orders_retrieve | - | `200` application/json: SalesOrder |
| `PUT` | `/api/sales-orders/{id}/` | sales_orders_update | `application/json`: `SalesOrder`<br>`application/x-www-form-urlencoded`: `SalesOrder`<br>`multipart/form-data`: `SalesOrder` zorunlu | `200` application/json: SalesOrder |
| `PATCH` | `/api/sales-orders/{id}/` | sales_orders_partial_update | `application/json`: `PatchedSalesOrder`<br>`application/x-www-form-urlencoded`: `PatchedSalesOrder`<br>`multipart/form-data`: `PatchedSalesOrder` | `200` application/json: SalesOrder |
| `DELETE` | `/api/sales-orders/{id}/` | sales_orders_destroy | - | `204` No response body |
| `GET` | `/api/stock-movements/` | stock_movements_list | - | `200` application/json: Array<StockMovement> |
| `POST` | `/api/stock-movements/` | stock_movements_create | `application/json`: `StockMovement`<br>`application/x-www-form-urlencoded`: `StockMovement`<br>`multipart/form-data`: `StockMovement` zorunlu | `201` application/json: StockMovement |
| `GET` | `/api/stock-movements/{id}/` | stock_movements_retrieve | - | `200` application/json: StockMovement |
| `PUT` | `/api/stock-movements/{id}/` | stock_movements_update | `application/json`: `StockMovement`<br>`application/x-www-form-urlencoded`: `StockMovement`<br>`multipart/form-data`: `StockMovement` zorunlu | `200` application/json: StockMovement |
| `PATCH` | `/api/stock-movements/{id}/` | stock_movements_partial_update | `application/json`: `PatchedStockMovement`<br>`application/x-www-form-urlencoded`: `PatchedStockMovement`<br>`multipart/form-data`: `PatchedStockMovement` | `200` application/json: StockMovement |
| `DELETE` | `/api/stock-movements/{id}/` | stock_movements_destroy | - | `204` No response body |
| `GET` | `/api/vehicles/` | vehicles_list | - | `200` application/json: Array<Vehicle> |
| `POST` | `/api/vehicles/` | vehicles_create | `application/json`: `Vehicle`<br>`application/x-www-form-urlencoded`: `Vehicle`<br>`multipart/form-data`: `Vehicle` | `201` application/json: Vehicle |
| `GET` | `/api/vehicles/{id}/` | vehicles_retrieve | - | `200` application/json: Vehicle |
| `PUT` | `/api/vehicles/{id}/` | vehicles_update | `application/json`: `Vehicle`<br>`application/x-www-form-urlencoded`: `Vehicle`<br>`multipart/form-data`: `Vehicle` | `200` application/json: Vehicle |
| `PATCH` | `/api/vehicles/{id}/` | vehicles_partial_update | `application/json`: `PatchedVehicle`<br>`application/x-www-form-urlencoded`: `PatchedVehicle`<br>`multipart/form-data`: `PatchedVehicle` | `200` application/json: Vehicle |
| `DELETE` | `/api/vehicles/{id}/` | vehicles_destroy | - | `204` No response body |

## CRM: Cari, Lead, Firsat, Kisi

| Method | Endpoint | Islev | Request Body | Basarili/Onemli Response |
|---|---|---|---|---|
| `GET` | `/api/contacts/` | contacts_list | - | `200` application/json: Array<Contact> |
| `POST` | `/api/contacts/` | contacts_create | `application/json`: `Contact`<br>`application/x-www-form-urlencoded`: `Contact`<br>`multipart/form-data`: `Contact` | `201` application/json: Contact |
| `GET` | `/api/contacts/{id}/` | contacts_retrieve | - | `200` application/json: Contact |
| `PUT` | `/api/contacts/{id}/` | contacts_update | `application/json`: `Contact`<br>`application/x-www-form-urlencoded`: `Contact`<br>`multipart/form-data`: `Contact` | `200` application/json: Contact |
| `PATCH` | `/api/contacts/{id}/` | contacts_partial_update | `application/json`: `PatchedContact`<br>`application/x-www-form-urlencoded`: `PatchedContact`<br>`multipart/form-data`: `PatchedContact` | `200` application/json: Contact |
| `DELETE` | `/api/contacts/{id}/` | contacts_destroy | - | `204` No response body |
| `GET` | `/api/leads/` | leads_list | - | `200` application/json: Array<Lead> |
| `POST` | `/api/leads/` | leads_create | `application/json`: `Lead`<br>`application/x-www-form-urlencoded`: `Lead`<br>`multipart/form-data`: `Lead` zorunlu | `201` application/json: Lead |
| `GET` | `/api/leads/{id}/` | leads_retrieve | - | `200` application/json: Lead |
| `PUT` | `/api/leads/{id}/` | leads_update | `application/json`: `Lead`<br>`application/x-www-form-urlencoded`: `Lead`<br>`multipart/form-data`: `Lead` zorunlu | `200` application/json: Lead |
| `PATCH` | `/api/leads/{id}/` | leads_partial_update | `application/json`: `PatchedLead`<br>`application/x-www-form-urlencoded`: `PatchedLead`<br>`multipart/form-data`: `PatchedLead` | `200` application/json: Lead |
| `DELETE` | `/api/leads/{id}/` | leads_destroy | - | `204` No response body |
| `GET` | `/api/opportunities/` | opportunities_list | - | `200` application/json: Array<Opportunity> |
| `POST` | `/api/opportunities/` | opportunities_create | `application/json`: `Opportunity`<br>`application/x-www-form-urlencoded`: `Opportunity`<br>`multipart/form-data`: `Opportunity` | `201` application/json: Opportunity |
| `GET` | `/api/opportunities/{id}/` | opportunities_retrieve | - | `200` application/json: Opportunity |
| `PUT` | `/api/opportunities/{id}/` | opportunities_update | `application/json`: `Opportunity`<br>`application/x-www-form-urlencoded`: `Opportunity`<br>`multipart/form-data`: `Opportunity` | `200` application/json: Opportunity |
| `PATCH` | `/api/opportunities/{id}/` | opportunities_partial_update | `application/json`: `PatchedOpportunity`<br>`application/x-www-form-urlencoded`: `PatchedOpportunity`<br>`multipart/form-data`: `PatchedOpportunity` | `200` application/json: Opportunity |
| `DELETE` | `/api/opportunities/{id}/` | opportunities_destroy | - | `204` No response body |
| `GET` | `/api/partners/` | partners_list | - | `200` application/json: Array<BusinessPartner> |
| `POST` | `/api/partners/` | partners_create | `application/json`: `BusinessPartner`<br>`application/x-www-form-urlencoded`: `BusinessPartner`<br>`multipart/form-data`: `BusinessPartner` | `201` application/json: BusinessPartner |
| `GET` | `/api/partners/{id}/` | partners_retrieve | - | `200` application/json: BusinessPartner |
| `PUT` | `/api/partners/{id}/` | partners_update | `application/json`: `BusinessPartner`<br>`application/x-www-form-urlencoded`: `BusinessPartner`<br>`multipart/form-data`: `BusinessPartner` | `200` application/json: BusinessPartner |
| `PATCH` | `/api/partners/{id}/` | partners_partial_update | `application/json`: `PatchedBusinessPartner`<br>`application/x-www-form-urlencoded`: `PatchedBusinessPartner`<br>`multipart/form-data`: `PatchedBusinessPartner` | `200` application/json: BusinessPartner |
| `DELETE` | `/api/partners/{id}/` | partners_destroy | - | `204` No response body |

## Teklif / Sozlesme / Satici Firma / Sablon

| Method | Endpoint | Islev | Request Body | Basarili/Onemli Response |
|---|---|---|---|---|
| `GET` | `/api/pricing-rules/` | pricing_rules_list | - | `200` application/json: Array<PricingRule> |
| `POST` | `/api/pricing-rules/` | pricing_rules_create | `application/json`: `PricingRule`<br>`application/x-www-form-urlencoded`: `PricingRule`<br>`multipart/form-data`: `PricingRule` zorunlu | `201` application/json: PricingRule |
| `GET` | `/api/pricing-rules/{id}/` | pricing_rules_retrieve | - | `200` application/json: PricingRule |
| `PUT` | `/api/pricing-rules/{id}/` | pricing_rules_update | `application/json`: `PricingRule`<br>`application/x-www-form-urlencoded`: `PricingRule`<br>`multipart/form-data`: `PricingRule` zorunlu | `200` application/json: PricingRule |
| `PATCH` | `/api/pricing-rules/{id}/` | pricing_rules_partial_update | `application/json`: `PatchedPricingRule`<br>`application/x-www-form-urlencoded`: `PatchedPricingRule`<br>`multipart/form-data`: `PatchedPricingRule` | `200` application/json: PricingRule |
| `DELETE` | `/api/pricing-rules/{id}/` | pricing_rules_destroy | - | `204` No response body |
| `GET` | `/api/quotes/` | quotes_list | - | `200` application/json: Array<Quote> |
| `POST` | `/api/quotes/` | quotes_create | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `201` application/json: Quote |
| `POST` | `/api/quotes/apply_preview/` | Apply pricing rules server-side and return recalculated totals for preview. | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `200` application/json: Quote |
| `GET` | `/api/quotes/template-library-download/` | quotes_template_library_download_retrieve | - | `200` application/json: Quote |
| `POST` | `/api/quotes/template-library-upload/` | Firma bazli Excel sablonu yukler. multipart/form-data kullanilir. | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `200` application/json: Quote |
| `GET` | `/api/quotes/template-library/` | quotes_template_library_retrieve | - | `200` application/json: Quote |
| `GET` | `/api/quotes/template-placeholders/` | quotes_template_placeholders_retrieve | - | `200` application/json: Quote |
| `GET` | `/api/quotes/{id}/` | quotes_retrieve | - | `200` application/json: Quote |
| `PUT` | `/api/quotes/{id}/` | quotes_update | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `200` application/json: Quote |
| `PATCH` | `/api/quotes/{id}/` | quotes_partial_update | `application/json`: `PatchedQuote`<br>`application/x-www-form-urlencoded`: `PatchedQuote`<br>`multipart/form-data`: `PatchedQuote` | `200` application/json: Quote |
| `DELETE` | `/api/quotes/{id}/` | quotes_destroy | - | `204` No response body |
| `POST` | `/api/quotes/{id}/approve/` | quotes_approve_create | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `200` application/json: Quote |
| `POST` | `/api/quotes/{id}/convert/` | quotes_convert_create | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `200` application/json: Quote |
| `GET` | `/api/quotes/{id}/export-excel/` | Belgeyi duzenlenebilir Excel olarak indirir; web sablon yonetimi icin korunur. | - | `200` application/json: Quote |
| `GET` | `/api/quotes/{id}/export-files/` | quotes_export_files_retrieve | - | `200` application/json: Quote |
| `GET` | `/api/quotes/{id}/export-pdf/` | Belgeyi PDF olarak indirir; dosya adi belge numarasidir. | - | `200` application/json: Quote |
| `GET` | `/api/quotes/{id}/export-xlsx/` | Geriye uyumluluk rotasidir; artik PDF dondurur. | - | `200` application/json: Quote |
| `POST` | `/api/quotes/{id}/reject/` | quotes_reject_create | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `200` application/json: Quote |
| `POST` | `/api/quotes/{id}/request_approval/` | quotes_request_approval_create | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `200` application/json: Quote |
| `POST` | `/api/quotes/{id}/resubmit/` | quotes_resubmit_create | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `200` application/json: Quote |
| `POST` | `/api/quotes/{id}/send/` | quotes_send_create | `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu | `200` application/json: Quote |
| `GET` | `/api/seller-companies/` | seller_companies_retrieve | - | `200` No response body |
| `POST` | `/api/seller-companies/` | seller_companies_create | - | `201` No response body |
| `PATCH` | `/api/seller-companies/{id}/` | seller_companies_partial_update | - | `200` No response body |
| `DELETE` | `/api/seller-companies/{id}/` | seller_companies_destroy | - | `204` No response body |
| `POST` | `/api/seller-companies/{id}/upload-logo/` | Satici firma logosu yukler. PNG/JPG/JPEG/SVG desteklenir. | - | `200` No response body |

## Ekipler

| Method | Endpoint | Islev | Request Body | Basarili/Onemli Response |
|---|---|---|---|---|
| `GET` | `/api/team-associates/` | Hesapsiz ekip calisanlari (CRUD). | - | `200` application/json: Array<TeamAssociate> |
| `POST` | `/api/team-associates/` | Hesapsiz ekip calisanlari (CRUD). | `application/json`: `TeamAssociate`<br>`application/x-www-form-urlencoded`: `TeamAssociate`<br>`multipart/form-data`: `TeamAssociate` zorunlu | `201` application/json: TeamAssociate |
| `GET` | `/api/team-associates/{id}/` | Hesapsiz ekip calisanlari (CRUD). | - | `200` application/json: TeamAssociate |
| `PUT` | `/api/team-associates/{id}/` | Hesapsiz ekip calisanlari (CRUD). | `application/json`: `TeamAssociate`<br>`application/x-www-form-urlencoded`: `TeamAssociate`<br>`multipart/form-data`: `TeamAssociate` zorunlu | `200` application/json: TeamAssociate |
| `PATCH` | `/api/team-associates/{id}/` | Hesapsiz ekip calisanlari (CRUD). | `application/json`: `PatchedTeamAssociate`<br>`application/x-www-form-urlencoded`: `PatchedTeamAssociate`<br>`multipart/form-data`: `PatchedTeamAssociate` | `200` application/json: TeamAssociate |
| `DELETE` | `/api/team-associates/{id}/` | Hesapsiz ekip calisanlari (CRUD). | - | `204` No response body |
| `GET` | `/api/teams/` | teams_list | - | `200` application/json: Array<Team> |
| `POST` | `/api/teams/` | teams_create | `application/json`: `Team`<br>`application/x-www-form-urlencoded`: `Team`<br>`multipart/form-data`: `Team` zorunlu | `201` application/json: Team |
| `GET` | `/api/teams/{id}/` | teams_retrieve | - | `200` application/json: Team |
| `PUT` | `/api/teams/{id}/` | teams_update | `application/json`: `Team`<br>`application/x-www-form-urlencoded`: `Team`<br>`multipart/form-data`: `Team` zorunlu | `200` application/json: Team |
| `PATCH` | `/api/teams/{id}/` | teams_partial_update | `application/json`: `PatchedTeam`<br>`application/x-www-form-urlencoded`: `PatchedTeam`<br>`multipart/form-data`: `PatchedTeam` | `200` application/json: Team |
| `DELETE` | `/api/teams/{id}/` | teams_destroy | - | `204` No response body |

## Public Website ve SaaS Admin

| Method | Endpoint | Islev | Request Body | Basarili/Onemli Response |
|---|---|---|---|---|
| `GET` | `/api/v1/admin/blog/` | Admin blog API - superadmin only. Full CRUD for blog posts. | - | `200` application/json: Array<BlogPostAdmin> |
| `POST` | `/api/v1/admin/blog/` | Admin blog API - superadmin only. Full CRUD for blog posts. | `application/json`: `BlogPostAdmin`<br>`application/x-www-form-urlencoded`: `BlogPostAdmin`<br>`multipart/form-data`: `BlogPostAdmin` zorunlu | `201` application/json: BlogPostAdmin |
| `GET` | `/api/v1/admin/blog/{id}/` | Admin blog API - superadmin only. Full CRUD for blog posts. | - | `200` application/json: BlogPostAdmin |
| `PUT` | `/api/v1/admin/blog/{id}/` | Admin blog API - superadmin only. Full CRUD for blog posts. | `application/json`: `BlogPostAdmin`<br>`application/x-www-form-urlencoded`: `BlogPostAdmin`<br>`multipart/form-data`: `BlogPostAdmin` zorunlu | `200` application/json: BlogPostAdmin |
| `PATCH` | `/api/v1/admin/blog/{id}/` | Admin blog API - superadmin only. Full CRUD for blog posts. | `application/json`: `PatchedBlogPostAdmin`<br>`application/x-www-form-urlencoded`: `PatchedBlogPostAdmin`<br>`multipart/form-data`: `PatchedBlogPostAdmin` | `200` application/json: BlogPostAdmin |
| `DELETE` | `/api/v1/admin/blog/{id}/` | Admin blog API - superadmin only. Full CRUD for blog posts. | - | `204` No response body |
| `POST` | `/api/v1/admin/blog/{id}/publish/` | Publish a draft post | `application/json`: `BlogPostAdmin`<br>`application/x-www-form-urlencoded`: `BlogPostAdmin`<br>`multipart/form-data`: `BlogPostAdmin` zorunlu | `200` application/json: BlogPostAdmin |
| `POST` | `/api/v1/admin/blog/{id}/unpublish/` | Unpublish a post | `application/json`: `BlogPostAdmin`<br>`application/x-www-form-urlencoded`: `BlogPostAdmin`<br>`multipart/form-data`: `BlogPostAdmin` zorunlu | `200` application/json: BlogPostAdmin |
| `GET` | `/api/v1/admin/contact/` | Admin contact submissions API - superadmin only. View and manage contact form submissions. | - | `200` application/json: Array<ContactSubmissionAdmin> |
| `GET` | `/api/v1/admin/contact/{id}/` | Admin contact submissions API - superadmin only. View and manage contact form submissions. | - | `200` application/json: ContactSubmissionAdmin |
| `PATCH` | `/api/v1/admin/contact/{id}/` | Admin contact submissions API - superadmin only. View and manage contact form submissions. | `application/json`: `PatchedContactSubmissionAdmin`<br>`application/x-www-form-urlencoded`: `PatchedContactSubmissionAdmin`<br>`multipart/form-data`: `PatchedContactSubmissionAdmin` | `200` application/json: ContactSubmissionAdmin |
| `GET` | `/api/v1/admin/plans/` | Admin plan management API - superadmin only. CRUD for subscription plans. | - | `200` application/json: Array<TenantPlan> |
| `POST` | `/api/v1/admin/plans/` | Admin plan management API - superadmin only. CRUD for subscription plans. | `application/json`: `TenantPlan`<br>`application/x-www-form-urlencoded`: `TenantPlan`<br>`multipart/form-data`: `TenantPlan` zorunlu | `201` application/json: TenantPlan |
| `GET` | `/api/v1/admin/plans/{id}/` | Admin plan management API - superadmin only. CRUD for subscription plans. | - | `200` application/json: TenantPlan |
| `PUT` | `/api/v1/admin/plans/{id}/` | Admin plan management API - superadmin only. CRUD for subscription plans. | `application/json`: `TenantPlan`<br>`application/x-www-form-urlencoded`: `TenantPlan`<br>`multipart/form-data`: `TenantPlan` zorunlu | `200` application/json: TenantPlan |
| `PATCH` | `/api/v1/admin/plans/{id}/` | Admin plan management API - superadmin only. CRUD for subscription plans. | `application/json`: `PatchedTenantPlan`<br>`application/x-www-form-urlencoded`: `PatchedTenantPlan`<br>`multipart/form-data`: `PatchedTenantPlan` | `200` application/json: TenantPlan |
| `DELETE` | `/api/v1/admin/plans/{id}/` | Admin plan management API - superadmin only. CRUD for subscription plans. | - | `204` No response body |
| `GET` | `/api/v1/admin/subscriptions/` | Admin subscription management API - superadmin only. CRUD for tenant subscriptions. | - | `200` application/json: Array<TenantSubscription> |
| `POST` | `/api/v1/admin/subscriptions/` | Admin subscription management API - superadmin only. CRUD for tenant subscriptions. | `application/json`: `TenantSubscription`<br>`application/x-www-form-urlencoded`: `TenantSubscription`<br>`multipart/form-data`: `TenantSubscription` zorunlu | `201` application/json: TenantSubscription |
| `GET` | `/api/v1/admin/subscriptions/{id}/` | Admin subscription management API - superadmin only. CRUD for tenant subscriptions. | - | `200` application/json: TenantSubscription |
| `PUT` | `/api/v1/admin/subscriptions/{id}/` | Admin subscription management API - superadmin only. CRUD for tenant subscriptions. | `application/json`: `TenantSubscription`<br>`application/x-www-form-urlencoded`: `TenantSubscription`<br>`multipart/form-data`: `TenantSubscription` zorunlu | `200` application/json: TenantSubscription |
| `PATCH` | `/api/v1/admin/subscriptions/{id}/` | Admin subscription management API - superadmin only. CRUD for tenant subscriptions. | `application/json`: `PatchedTenantSubscription`<br>`application/x-www-form-urlencoded`: `PatchedTenantSubscription`<br>`multipart/form-data`: `PatchedTenantSubscription` | `200` application/json: TenantSubscription |
| `DELETE` | `/api/v1/admin/subscriptions/{id}/` | Admin subscription management API - superadmin only. CRUD for tenant subscriptions. | - | `204` No response body |
| `GET` | `/api/v1/admin/tenants/` | Admin tenant management API - superadmin only. CRUD for organizations/tenants. | - | `200` application/json: Array<TenantDetail> |
| `POST` | `/api/v1/admin/tenants/` | Admin tenant management API - superadmin only. CRUD for organizations/tenants. | `application/json`: `TenantDetail`<br>`application/x-www-form-urlencoded`: `TenantDetail`<br>`multipart/form-data`: `TenantDetail` zorunlu | `201` application/json: TenantDetail |
| `GET` | `/api/v1/admin/tenants/{id}/` | Admin tenant management API - superadmin only. CRUD for organizations/tenants. | - | `200` application/json: TenantDetail |
| `PUT` | `/api/v1/admin/tenants/{id}/` | Admin tenant management API - superadmin only. CRUD for organizations/tenants. | `application/json`: `TenantDetail`<br>`application/x-www-form-urlencoded`: `TenantDetail`<br>`multipart/form-data`: `TenantDetail` zorunlu | `200` application/json: TenantDetail |
| `PATCH` | `/api/v1/admin/tenants/{id}/` | Admin tenant management API - superadmin only. CRUD for organizations/tenants. | `application/json`: `PatchedTenantDetail`<br>`application/x-www-form-urlencoded`: `PatchedTenantDetail`<br>`multipart/form-data`: `PatchedTenantDetail` | `200` application/json: TenantDetail |
| `DELETE` | `/api/v1/admin/tenants/{id}/` | Admin tenant management API - superadmin only. CRUD for organizations/tenants. | - | `204` No response body |
| `GET` | `/api/v1/admin/tenants/{id}/users/` | Get all users for a tenant | - | `200` application/json: TenantDetail |
| `GET` | `/api/v1/blog-categories/` | Public blog categories | - | `200` application/json: Array<BlogCategory> |
| `GET` | `/api/v1/blog-categories/{slug}/` | Public blog categories | - | `200` application/json: BlogCategory |
| `GET` | `/api/v1/blog/` | Public blog API - no authentication required. Only shows published posts. | - | `200` application/json: Array<BlogPostList> |
| `GET` | `/api/v1/blog/{slug}/` | Increment view count on detail view | - | `200` application/json: BlogPostDetail |
| `POST` | `/api/v1/contact/` | Public contact form submission. Rate limited to prevent spam. | - | `200` No response body |

## Endpoint Detaylari

### Onay ve Denetim

#### `GET /api/approvals/`

- Islev: approvals_list
- OpenAPI operationId: `approvals_list`
- Tag: `approvals`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<ApprovalInstance>

#### `GET /api/approvals/pending/`

- Islev: approvals_pending_retrieve
- OpenAPI operationId: `approvals_pending_retrieve`
- Tag: `approvals`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/approvals/step/{id}/action/`

- Islev: approvals_step_action_create
- OpenAPI operationId: `approvals_step_action_create`
- Tag: `approvals`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` |  |
- Request body: -
- Response: `200` No response body

#### `GET /api/approvals/{id}/`

- Islev: approvals_retrieve
- OpenAPI operationId: `approvals_retrieve`
- Tag: `approvals`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this approval instance. |
- Request body: -
- Response: `200` application/json: ApprovalInstance

#### `GET /api/audit/`

- Islev: audit_list
- OpenAPI operationId: `audit_list`
- Tag: `audit`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<AuditLog>

#### `GET /api/audit/{id}/`

- Islev: audit_retrieve
- OpenAPI operationId: `audit_retrieve`
- Tag: `audit`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this audit log. |
- Request body: -
- Response: `200` application/json: AuditLog

### Auth ve Kullanici

#### `POST /api/auth/activate/`

- Islev: auth_activate_create
- OpenAPI operationId: `auth_activate_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/bulk-create-users/`

- Islev: Admin: Her satir 'Ad Soyad' - benzersiz kullanici adi ve sifre uretilir (e-posta zorunlu degil).
- OpenAPI operationId: `auth_bulk_create_users_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/change-password/`

- Islev: auth_change_password_create
- OpenAPI operationId: `auth_change_password_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/create-user/`

- Islev: auth_create_user_create
- OpenAPI operationId: `auth_create_user_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/invite/`

- Islev: auth_invite_create
- OpenAPI operationId: `auth_invite_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/login/`

- Islev: JWT access/refresh token alir. Body: username/password, 2FA aciksa otp gerekebilir.
- OpenAPI operationId: `auth_login_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TwoFATokenObtainPair`<br>`application/x-www-form-urlencoded`: `TwoFATokenObtainPair`<br>`multipart/form-data`: `TwoFATokenObtainPair` zorunlu
- Response: `200` application/json: TwoFATokenObtainPair

#### `GET /api/auth/me/`

- Islev: Mobil uygulama acilisinda aktif kullanici, rol ve organizasyon bilgisini alir.
- OpenAPI operationId: `auth_me_retrieve`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `GET /api/auth/notification-prefs/`

- Islev: auth_notification_prefs_retrieve
- OpenAPI operationId: `auth_notification_prefs_retrieve`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/notification-prefs/`

- Islev: auth_notification_prefs_create
- OpenAPI operationId: `auth_notification_prefs_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `GET /api/auth/organization-settings/`

- Islev: auth_organization_settings_retrieve
- OpenAPI operationId: `auth_organization_settings_retrieve`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `PATCH /api/auth/organization-settings/`

- Islev: auth_organization_settings_partial_update
- OpenAPI operationId: `auth_organization_settings_partial_update`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/otp/disable/`

- Islev: auth_otp_disable_create
- OpenAPI operationId: `auth_otp_disable_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/otp/enable/`

- Islev: auth_otp_enable_create
- OpenAPI operationId: `auth_otp_enable_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/otp/setup/`

- Islev: auth_otp_setup_create
- OpenAPI operationId: `auth_otp_setup_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/password-reset/`

- Islev: auth_password_reset_create
- OpenAPI operationId: `auth_password_reset_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/password-reset/confirm/`

- Islev: auth_password_reset_confirm_create
- OpenAPI operationId: `auth_password_reset_confirm_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `GET /api/auth/permissions/`

- Islev: auth_permissions_retrieve
- OpenAPI operationId: `auth_permissions_retrieve`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/refresh/`

- Islev: Refresh token ile yeni access token uretir.
- OpenAPI operationId: `auth_refresh_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TokenRefresh`<br>`application/x-www-form-urlencoded`: `TokenRefresh`<br>`multipart/form-data`: `TokenRefresh` zorunlu
- Response: `200` application/json: TokenRefresh

#### `GET /api/auth/role-perms/`

- Islev: auth_role_perms_retrieve
- OpenAPI operationId: `auth_role_perms_retrieve`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/auth/role-perms/`

- Islev: auth_role_perms_create
- OpenAPI operationId: `auth_role_perms_create`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `GET /api/auth/users/`

- Islev: auth_users_retrieve
- OpenAPI operationId: `auth_users_retrieve`
- Tag: `auth`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `PATCH /api/auth/users/{id}/`

- Islev: Admin: organizasyondaki kullaniciyi kalici siler (FK'ler SET_NULL ise guvenli).
- OpenAPI operationId: `auth_users_partial_update`
- Tag: `auth`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` |  |
- Request body: -
- Response: `200` No response body

#### `DELETE /api/auth/users/{id}/`

- Islev: Admin: organizasyondaki kullaniciyi kalici siler (FK'ler SET_NULL ise guvenli).
- OpenAPI operationId: `auth_users_destroy`
- Tag: `auth`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` |  |
- Request body: -
- Response: `204` No response body

### Gorev, Destek, Dosya, Otomasyon

#### `GET /api/automation-rules/`

- Islev: automation_rules_list
- OpenAPI operationId: `automation_rules_list`
- Tag: `automation-rules`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<AutomationRule>

#### `POST /api/automation-rules/`

- Islev: automation_rules_create
- OpenAPI operationId: `automation_rules_create`
- Tag: `automation-rules`
- Parametreler: Parametre yok.
- Request body: `application/json`: `AutomationRule`<br>`application/x-www-form-urlencoded`: `AutomationRule`<br>`multipart/form-data`: `AutomationRule` zorunlu
- Response: `201` application/json: AutomationRule

#### `GET /api/automation-rules/help/`

- Islev: automation_rules_help_retrieve
- OpenAPI operationId: `automation_rules_help_retrieve`
- Tag: `automation-rules`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: AutomationRule

#### `POST /api/automation-rules/test/`

- Islev: Dry-run automation: evaluates condition and returns would-be actions without side effects. Body: {trigger, condition, action, action_payload, sample_task: {...}, extra: {...}}
- OpenAPI operationId: `automation_rules_test_create`
- Tag: `automation-rules`
- Parametreler: Parametre yok.
- Request body: `application/json`: `AutomationRule`<br>`application/x-www-form-urlencoded`: `AutomationRule`<br>`multipart/form-data`: `AutomationRule` zorunlu
- Response: `200` application/json: AutomationRule

#### `GET /api/automation-rules/{id}/`

- Islev: automation_rules_retrieve
- OpenAPI operationId: `automation_rules_retrieve`
- Tag: `automation-rules`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this automation rule. |
- Request body: -
- Response: `200` application/json: AutomationRule

#### `PUT /api/automation-rules/{id}/`

- Islev: automation_rules_update
- OpenAPI operationId: `automation_rules_update`
- Tag: `automation-rules`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this automation rule. |
- Request body: `application/json`: `AutomationRule`<br>`application/x-www-form-urlencoded`: `AutomationRule`<br>`multipart/form-data`: `AutomationRule` zorunlu
- Response: `200` application/json: AutomationRule

#### `PATCH /api/automation-rules/{id}/`

- Islev: automation_rules_partial_update
- OpenAPI operationId: `automation_rules_partial_update`
- Tag: `automation-rules`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this automation rule. |
- Request body: `application/json`: `PatchedAutomationRule`<br>`application/x-www-form-urlencoded`: `PatchedAutomationRule`<br>`multipart/form-data`: `PatchedAutomationRule`
- Response: `200` application/json: AutomationRule

#### `DELETE /api/automation-rules/{id}/`

- Islev: automation_rules_destroy
- OpenAPI operationId: `automation_rules_destroy`
- Tag: `automation-rules`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this automation rule. |
- Request body: -
- Response: `204` No response body

#### `GET /api/task-attachments/`

- Islev: task_attachments_list
- OpenAPI operationId: `task_attachments_list`
- Tag: `task-attachments`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<TaskAttachment>

#### `POST /api/task-attachments/`

- Islev: task_attachments_create
- OpenAPI operationId: `task_attachments_create`
- Tag: `task-attachments`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TaskAttachment`<br>`application/x-www-form-urlencoded`: `TaskAttachment`<br>`multipart/form-data`: `TaskAttachment` zorunlu
- Response: `201` application/json: TaskAttachment

#### `GET /api/task-attachments/{id}/`

- Islev: task_attachments_retrieve
- OpenAPI operationId: `task_attachments_retrieve`
- Tag: `task-attachments`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task attachment. |
- Request body: -
- Response: `200` application/json: TaskAttachment

#### `PUT /api/task-attachments/{id}/`

- Islev: task_attachments_update
- OpenAPI operationId: `task_attachments_update`
- Tag: `task-attachments`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task attachment. |
- Request body: `application/json`: `TaskAttachment`<br>`application/x-www-form-urlencoded`: `TaskAttachment`<br>`multipart/form-data`: `TaskAttachment` zorunlu
- Response: `200` application/json: TaskAttachment

#### `PATCH /api/task-attachments/{id}/`

- Islev: task_attachments_partial_update
- OpenAPI operationId: `task_attachments_partial_update`
- Tag: `task-attachments`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task attachment. |
- Request body: `application/json`: `PatchedTaskAttachment`<br>`application/x-www-form-urlencoded`: `PatchedTaskAttachment`<br>`multipart/form-data`: `PatchedTaskAttachment`
- Response: `200` application/json: TaskAttachment

#### `DELETE /api/task-attachments/{id}/`

- Islev: task_attachments_destroy
- OpenAPI operationId: `task_attachments_destroy`
- Tag: `task-attachments`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task attachment. |
- Request body: -
- Response: `204` No response body

#### `GET /api/task-checklist/`

- Islev: task_checklist_list
- OpenAPI operationId: `task_checklist_list`
- Tag: `task-checklist`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<TaskChecklist>

#### `POST /api/task-checklist/`

- Islev: task_checklist_create
- OpenAPI operationId: `task_checklist_create`
- Tag: `task-checklist`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TaskChecklist`<br>`application/x-www-form-urlencoded`: `TaskChecklist`<br>`multipart/form-data`: `TaskChecklist` zorunlu
- Response: `201` application/json: TaskChecklist

#### `POST /api/task-checklist/reorder/`

- Islev: Sira guncelle: { "task": "<task_id>", "order": ["<id1>", "<id2>", ...] }
- OpenAPI operationId: `task_checklist_reorder_create`
- Tag: `task-checklist`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TaskChecklist`<br>`application/x-www-form-urlencoded`: `TaskChecklist`<br>`multipart/form-data`: `TaskChecklist` zorunlu
- Response: `200` application/json: TaskChecklist

#### `GET /api/task-checklist/{id}/`

- Islev: task_checklist_retrieve
- OpenAPI operationId: `task_checklist_retrieve`
- Tag: `task-checklist`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task checklist. |
- Request body: -
- Response: `200` application/json: TaskChecklist

#### `PUT /api/task-checklist/{id}/`

- Islev: task_checklist_update
- OpenAPI operationId: `task_checklist_update`
- Tag: `task-checklist`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task checklist. |
- Request body: `application/json`: `TaskChecklist`<br>`application/x-www-form-urlencoded`: `TaskChecklist`<br>`multipart/form-data`: `TaskChecklist` zorunlu
- Response: `200` application/json: TaskChecklist

#### `PATCH /api/task-checklist/{id}/`

- Islev: task_checklist_partial_update
- OpenAPI operationId: `task_checklist_partial_update`
- Tag: `task-checklist`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task checklist. |
- Request body: `application/json`: `PatchedTaskChecklist`<br>`application/x-www-form-urlencoded`: `PatchedTaskChecklist`<br>`multipart/form-data`: `PatchedTaskChecklist`
- Response: `200` application/json: TaskChecklist

#### `DELETE /api/task-checklist/{id}/`

- Islev: task_checklist_destroy
- OpenAPI operationId: `task_checklist_destroy`
- Tag: `task-checklist`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task checklist. |
- Request body: -
- Response: `204` No response body

#### `GET /api/task-comments/`

- Islev: task_comments_list
- OpenAPI operationId: `task_comments_list`
- Tag: `task-comments`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<TaskComment>

#### `POST /api/task-comments/`

- Islev: task_comments_create
- OpenAPI operationId: `task_comments_create`
- Tag: `task-comments`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TaskComment`<br>`application/x-www-form-urlencoded`: `TaskComment`<br>`multipart/form-data`: `TaskComment` zorunlu
- Response: `201` application/json: TaskComment

#### `GET /api/task-comments/{id}/`

- Islev: task_comments_retrieve
- OpenAPI operationId: `task_comments_retrieve`
- Tag: `task-comments`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task comment. |
- Request body: -
- Response: `200` application/json: TaskComment

#### `PUT /api/task-comments/{id}/`

- Islev: task_comments_update
- OpenAPI operationId: `task_comments_update`
- Tag: `task-comments`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task comment. |
- Request body: `application/json`: `TaskComment`<br>`application/x-www-form-urlencoded`: `TaskComment`<br>`multipart/form-data`: `TaskComment` zorunlu
- Response: `200` application/json: TaskComment

#### `PATCH /api/task-comments/{id}/`

- Islev: task_comments_partial_update
- OpenAPI operationId: `task_comments_partial_update`
- Tag: `task-comments`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task comment. |
- Request body: `application/json`: `PatchedTaskComment`<br>`application/x-www-form-urlencoded`: `PatchedTaskComment`<br>`multipart/form-data`: `PatchedTaskComment`
- Response: `200` application/json: TaskComment

#### `DELETE /api/task-comments/{id}/`

- Islev: task_comments_destroy
- OpenAPI operationId: `task_comments_destroy`
- Tag: `task-comments`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task comment. |
- Request body: -
- Response: `204` No response body

#### `GET /api/task-models/`

- Islev: Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir.
- OpenAPI operationId: `task_models_list`
- Tag: `task-models`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
- Request body: -
- Response: `200` application/json: Array<TaskModel>

#### `POST /api/task-models/`

- Islev: Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir.
- OpenAPI operationId: `task_models_create`
- Tag: `task-models`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TaskModel`<br>`application/x-www-form-urlencoded`: `TaskModel`<br>`multipart/form-data`: `TaskModel` zorunlu
- Response: `201` application/json: TaskModel

#### `GET /api/task-models/{id}/`

- Islev: Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir.
- OpenAPI operationId: `task_models_retrieve`
- Tag: `task-models`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task model. |
- Request body: -
- Response: `200` application/json: TaskModel

#### `PUT /api/task-models/{id}/`

- Islev: Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir.
- OpenAPI operationId: `task_models_update`
- Tag: `task-models`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task model. |
- Request body: `application/json`: `TaskModel`<br>`application/x-www-form-urlencoded`: `TaskModel`<br>`multipart/form-data`: `TaskModel` zorunlu
- Response: `200` application/json: TaskModel

#### `PATCH /api/task-models/{id}/`

- Islev: Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir.
- OpenAPI operationId: `task_models_partial_update`
- Tag: `task-models`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task model. |
- Request body: `application/json`: `PatchedTaskModel`<br>`application/x-www-form-urlencoded`: `PatchedTaskModel`<br>`multipart/form-data`: `PatchedTaskModel`
- Response: `200` application/json: TaskModel

#### `DELETE /api/task-models/{id}/`

- Islev: Sabit gorev modelleri (AY-01 vb.) - Admin/Manager yonetir.
- OpenAPI operationId: `task_models_destroy`
- Tag: `task-models`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task model. |
- Request body: -
- Response: `204` No response body

#### `GET /api/task-reports/export/`

- Islev: Gorev raporunu xlsx/docx olarak indirir.
- OpenAPI operationId: `task_reports_export_retrieve`
- Tag: `task-reports`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `GET /api/task-reports/summary/`

- Islev: task_reports_summary_retrieve
- OpenAPI operationId: `task_reports_summary_retrieve`
- Tag: `task-reports`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `GET /api/task-time-entries/`

- Islev: task_time_entries_list
- OpenAPI operationId: `task_time_entries_list`
- Tag: `task-time-entries`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<TaskTimeEntry>

#### `POST /api/task-time-entries/`

- Islev: task_time_entries_create
- OpenAPI operationId: `task_time_entries_create`
- Tag: `task-time-entries`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TaskTimeEntry`<br>`application/x-www-form-urlencoded`: `TaskTimeEntry`<br>`multipart/form-data`: `TaskTimeEntry` zorunlu
- Response: `201` application/json: TaskTimeEntry

#### `GET /api/task-time-entries/{id}/`

- Islev: task_time_entries_retrieve
- OpenAPI operationId: `task_time_entries_retrieve`
- Tag: `task-time-entries`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task time entry. |
- Request body: -
- Response: `200` application/json: TaskTimeEntry

#### `PUT /api/task-time-entries/{id}/`

- Islev: task_time_entries_update
- OpenAPI operationId: `task_time_entries_update`
- Tag: `task-time-entries`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task time entry. |
- Request body: `application/json`: `TaskTimeEntry`<br>`application/x-www-form-urlencoded`: `TaskTimeEntry`<br>`multipart/form-data`: `TaskTimeEntry` zorunlu
- Response: `200` application/json: TaskTimeEntry

#### `PATCH /api/task-time-entries/{id}/`

- Islev: task_time_entries_partial_update
- OpenAPI operationId: `task_time_entries_partial_update`
- Tag: `task-time-entries`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task time entry. |
- Request body: `application/json`: `PatchedTaskTimeEntry`<br>`application/x-www-form-urlencoded`: `PatchedTaskTimeEntry`<br>`multipart/form-data`: `PatchedTaskTimeEntry`
- Response: `200` application/json: TaskTimeEntry

#### `DELETE /api/task-time-entries/{id}/`

- Islev: task_time_entries_destroy
- OpenAPI operationId: `task_time_entries_destroy`
- Tag: `task-time-entries`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this task time entry. |
- Request body: -
- Response: `204` No response body

#### `GET /api/tasks/`

- Islev: tasks_list
- OpenAPI operationId: `tasks_list`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<Task>

#### `POST /api/tasks/`

- Islev: tasks_create
- OpenAPI operationId: `tasks_create`
- Tag: `tasks`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `201` application/json: Task

#### `POST /api/tasks/import-excel/`

- Islev: Gorev uretim Excel dosyasini ice aktarir.
- OpenAPI operationId: `tasks_import_excel_create`
- Tag: `tasks`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `200` application/json: Task

#### `GET /api/tasks/my-team-queue/`

- Islev: Worker icin: sirali akista yalnizca ilgili ekip usta basisi (havuzdaki gorevler); paralel akista ilgili bolum uyeleri. Liste sonunda kullaniciya gore filtrelenir.
- OpenAPI operationId: `tasks_my_team_queue_retrieve`
- Tag: `tasks`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Task

#### `GET /api/tasks/production-report/`

- Islev: Gunluk uretim: ?date=YYYY-MM-DD (yonetici)
- OpenAPI operationId: `tasks_production_report_retrieve`
- Tag: `tasks`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Task

#### `GET /api/tasks/worker-detail/`

- Islev: Calisan detay: gunluk/aylik sure, aktif/biten gorevler. Query: ?worker_id=123
- OpenAPI operationId: `tasks_worker_detail_retrieve`
- Tag: `tasks`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Task

#### `GET /api/tasks/worker-tracking/`

- Islev: Admin/Manager icin worker tracking endpoint'i. Her worker'in hangi departmanda calistigini gosterir.
- OpenAPI operationId: `tasks_worker_tracking_retrieve`
- Tag: `tasks`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Task

#### `GET /api/tasks/{id}/`

- Islev: tasks_retrieve
- OpenAPI operationId: `tasks_retrieve`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: -
- Response: `200` application/json: Task

#### `PUT /api/tasks/{id}/`

- Islev: tasks_update
- OpenAPI operationId: `tasks_update`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `200` application/json: Task

#### `PATCH /api/tasks/{id}/`

- Islev: tasks_partial_update
- OpenAPI operationId: `tasks_partial_update`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: `application/json`: `PatchedTask`<br>`application/x-www-form-urlencoded`: `PatchedTask`<br>`multipart/form-data`: `PatchedTask`
- Response: `200` application/json: Task

#### `DELETE /api/tasks/{id}/`

- Islev: tasks_destroy
- OpenAPI operationId: `tasks_destroy`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: -
- Response: `204` No response body

#### `POST /api/tasks/{id}/approve-section/`

- Islev: Usta basi / yonetici: paralel akista bolum onayi (tum bolumler bitince done); sirali akista onay sonrasi siradaki ekibe devir veya gorevin kapanmasi.
- OpenAPI operationId: `tasks_approve_section_create`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `200` application/json: Task

#### `POST /api/tasks/{id}/claim/`

- Islev: Worker ekibindeki bekleyen gorevi ustlenir. Paralel akista workflow icindeki uygun bolumde ustlenir.
- OpenAPI operationId: `tasks_claim_create`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `200` application/json: Task

#### `POST /api/tasks/{id}/complete-stage/`

- Islev: Paralel akis: aktif ekipte bolum tamamlaninca otomatik olarak siradaki ekibe gecer. Sirali is akisi (workflow_team_ids, workflow_parallel kapali): ekip uyesi bitir ile onaya gonderir; usta basi approve_section ile siradaki ekibe devreder veya gorevi kapatir. Is akisi tanimsizsa fabrika sirasi ile devretme / tamamlama (onceki davranis).
- OpenAPI operationId: `tasks_complete_stage_create`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `200` application/json: Task

#### `POST /api/tasks/{id}/handover/`

- Islev: tasks_handover_create
- OpenAPI operationId: `tasks_handover_create`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `200` application/json: Task

#### `POST /api/tasks/{id}/log-production/`

- Islev: Gunluk tamamlanan adet - istege bagli siparise quantity_produced yansir.
- OpenAPI operationId: `tasks_log_production_create`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `200` application/json: Task

#### `POST /api/tasks/{id}/release-to-team/`

- Islev: Usta basi: gorevi ekibe acar (assignee temizlenir, uyeler ustlenebilir).
- OpenAPI operationId: `tasks_release_to_team_create`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `200` application/json: Task

#### `POST /api/tasks/{id}/self_handover/`

- Islev: Worker kendi gorevini baska ekibe devredebilir (bolum degisimi icin)
- OpenAPI operationId: `tasks_self_handover_create`
- Tag: `tasks`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: `application/json`: `Task`<br>`application/x-www-form-urlencoded`: `Task`<br>`multipart/form-data`: `Task` zorunlu
- Response: `200` application/json: Task

#### `GET /api/ticket-messages/`

- Islev: ticket_messages_list
- OpenAPI operationId: `ticket_messages_list`
- Tag: `ticket-messages`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<TicketMessage>

#### `POST /api/ticket-messages/`

- Islev: ticket_messages_create
- OpenAPI operationId: `ticket_messages_create`
- Tag: `ticket-messages`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TicketMessage`<br>`application/x-www-form-urlencoded`: `TicketMessage`<br>`multipart/form-data`: `TicketMessage` zorunlu
- Response: `201` application/json: TicketMessage

#### `GET /api/ticket-messages/{id}/`

- Islev: ticket_messages_retrieve
- OpenAPI operationId: `ticket_messages_retrieve`
- Tag: `ticket-messages`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this ticket message. |
- Request body: -
- Response: `200` application/json: TicketMessage

#### `PUT /api/ticket-messages/{id}/`

- Islev: ticket_messages_update
- OpenAPI operationId: `ticket_messages_update`
- Tag: `ticket-messages`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this ticket message. |
- Request body: `application/json`: `TicketMessage`<br>`application/x-www-form-urlencoded`: `TicketMessage`<br>`multipart/form-data`: `TicketMessage` zorunlu
- Response: `200` application/json: TicketMessage

#### `PATCH /api/ticket-messages/{id}/`

- Islev: ticket_messages_partial_update
- OpenAPI operationId: `ticket_messages_partial_update`
- Tag: `ticket-messages`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this ticket message. |
- Request body: `application/json`: `PatchedTicketMessage`<br>`application/x-www-form-urlencoded`: `PatchedTicketMessage`<br>`multipart/form-data`: `PatchedTicketMessage`
- Response: `200` application/json: TicketMessage

#### `DELETE /api/ticket-messages/{id}/`

- Islev: ticket_messages_destroy
- OpenAPI operationId: `ticket_messages_destroy`
- Tag: `ticket-messages`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this ticket message. |
- Request body: -
- Response: `204` No response body

#### `GET /api/tickets/`

- Islev: tickets_list
- OpenAPI operationId: `tickets_list`
- Tag: `tickets`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<Ticket>

#### `POST /api/tickets/`

- Islev: tickets_create
- OpenAPI operationId: `tickets_create`
- Tag: `tickets`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Ticket`<br>`application/x-www-form-urlencoded`: `Ticket`<br>`multipart/form-data`: `Ticket` zorunlu
- Response: `201` application/json: Ticket

#### `GET /api/tickets/{id}/`

- Islev: tickets_retrieve
- OpenAPI operationId: `tickets_retrieve`
- Tag: `tickets`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this ticket. |
- Request body: -
- Response: `200` application/json: Ticket

#### `PUT /api/tickets/{id}/`

- Islev: tickets_update
- OpenAPI operationId: `tickets_update`
- Tag: `tickets`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this ticket. |
- Request body: `application/json`: `Ticket`<br>`application/x-www-form-urlencoded`: `Ticket`<br>`multipart/form-data`: `Ticket` zorunlu
- Response: `200` application/json: Ticket

#### `PATCH /api/tickets/{id}/`

- Islev: tickets_partial_update
- OpenAPI operationId: `tickets_partial_update`
- Tag: `tickets`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this ticket. |
- Request body: `application/json`: `PatchedTicket`<br>`application/x-www-form-urlencoded`: `PatchedTicket`<br>`multipart/form-data`: `PatchedTicket`
- Response: `200` application/json: Ticket

#### `DELETE /api/tickets/{id}/`

- Islev: tickets_destroy
- OpenAPI operationId: `tickets_destroy`
- Tag: `tickets`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this ticket. |
- Request body: -
- Response: `204` No response body

#### `POST /api/uploads/presign/`

- Islev: Mobil/web dosya yukleme icin upload stratejisi dondurur; direct/S3/MinIO destekler.
- OpenAPI operationId: `uploads_presign_create`
- Tag: `uploads`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

### Dashboard, Arama, Saglik, SSE

#### `GET /api/calendar/ics/`

- Islev: calendar_ics_retrieve
- OpenAPI operationId: `calendar_ics_retrieve`
- Tag: `calendar`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `GET /api/dashboard/kpis/`

- Islev: dashboard_kpis_retrieve
- OpenAPI operationId: `dashboard_kpis_retrieve`
- Tag: `dashboard`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `GET /api/search/`

- Islev: search_retrieve
- OpenAPI operationId: `search_retrieve`
- Tag: `search`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `GET /api/stream/`

- Islev: SSE canli olay akisi. EventSource header tasiyamadigi icin token query param ile gonderilir.
- OpenAPI operationId: `stream_retrieve`
- Tag: `stream`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

### ERP: Stok, Urun, Siparis, Fatura, Lojistik

#### `GET /api/categories/`

- Islev: categories_list
- OpenAPI operationId: `categories_list`
- Tag: `categories`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<Category>

#### `POST /api/categories/`

- Islev: categories_create
- OpenAPI operationId: `categories_create`
- Tag: `categories`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Category`<br>`application/x-www-form-urlencoded`: `Category`<br>`multipart/form-data`: `Category`
- Response: `201` application/json: Category

#### `GET /api/categories/{id}/`

- Islev: categories_retrieve
- OpenAPI operationId: `categories_retrieve`
- Tag: `categories`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this category. |
- Request body: -
- Response: `200` application/json: Category

#### `PUT /api/categories/{id}/`

- Islev: categories_update
- OpenAPI operationId: `categories_update`
- Tag: `categories`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this category. |
- Request body: `application/json`: `Category`<br>`application/x-www-form-urlencoded`: `Category`<br>`multipart/form-data`: `Category`
- Response: `200` application/json: Category

#### `PATCH /api/categories/{id}/`

- Islev: categories_partial_update
- OpenAPI operationId: `categories_partial_update`
- Tag: `categories`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this category. |
- Request body: `application/json`: `PatchedCategory`<br>`application/x-www-form-urlencoded`: `PatchedCategory`<br>`multipart/form-data`: `PatchedCategory`
- Response: `200` application/json: Category

#### `DELETE /api/categories/{id}/`

- Islev: categories_destroy
- OpenAPI operationId: `categories_destroy`
- Tag: `categories`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this category. |
- Request body: -
- Response: `204` No response body

#### `GET /api/invoices/`

- Islev: invoices_list
- OpenAPI operationId: `invoices_list`
- Tag: `invoices`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<Invoice>

#### `POST /api/invoices/`

- Islev: invoices_create
- OpenAPI operationId: `invoices_create`
- Tag: `invoices`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Invoice`<br>`application/x-www-form-urlencoded`: `Invoice`<br>`multipart/form-data`: `Invoice` zorunlu
- Response: `201` application/json: Invoice

#### `GET /api/invoices/{id}/`

- Islev: invoices_retrieve
- OpenAPI operationId: `invoices_retrieve`
- Tag: `invoices`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this invoice. |
- Request body: -
- Response: `200` application/json: Invoice

#### `PUT /api/invoices/{id}/`

- Islev: invoices_update
- OpenAPI operationId: `invoices_update`
- Tag: `invoices`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this invoice. |
- Request body: `application/json`: `Invoice`<br>`application/x-www-form-urlencoded`: `Invoice`<br>`multipart/form-data`: `Invoice` zorunlu
- Response: `200` application/json: Invoice

#### `PATCH /api/invoices/{id}/`

- Islev: invoices_partial_update
- OpenAPI operationId: `invoices_partial_update`
- Tag: `invoices`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this invoice. |
- Request body: `application/json`: `PatchedInvoice`<br>`application/x-www-form-urlencoded`: `PatchedInvoice`<br>`multipart/form-data`: `PatchedInvoice`
- Response: `200` application/json: Invoice

#### `DELETE /api/invoices/{id}/`

- Islev: invoices_destroy
- OpenAPI operationId: `invoices_destroy`
- Tag: `invoices`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this invoice. |
- Request body: -
- Response: `204` No response body

#### `GET /api/products/`

- Islev: products_list
- OpenAPI operationId: `products_list`
- Tag: `products`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<Product>

#### `POST /api/products/`

- Islev: products_create
- OpenAPI operationId: `products_create`
- Tag: `products`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Product`<br>`application/x-www-form-urlencoded`: `Product`<br>`multipart/form-data`: `Product`
- Response: `201` application/json: Product

#### `POST /api/products/bulk-upsert/`

- Islev: Toplu urun/kategori senkronizasyonu icin JSON API.
- OpenAPI operationId: `products_bulk_upsert_create`
- Tag: `products`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Product`<br>`application/x-www-form-urlencoded`: `Product`<br>`multipart/form-data`: `Product`
- Response: `200` application/json: Product

#### `POST /api/products/import-template-catalog/`

- Islev: Sistem sablon urun katalogunu stok tarafina aktarir.
- OpenAPI operationId: `products_import_template_catalog_create`
- Tag: `products`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Product`<br>`application/x-www-form-urlencoded`: `Product`<br>`multipart/form-data`: `Product`
- Response: `200` application/json: Product

#### `GET /api/products/{id}/`

- Islev: products_retrieve
- OpenAPI operationId: `products_retrieve`
- Tag: `products`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this product. |
- Request body: -
- Response: `200` application/json: Product

#### `PUT /api/products/{id}/`

- Islev: products_update
- OpenAPI operationId: `products_update`
- Tag: `products`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this product. |
- Request body: `application/json`: `Product`<br>`application/x-www-form-urlencoded`: `Product`<br>`multipart/form-data`: `Product`
- Response: `200` application/json: Product

#### `PATCH /api/products/{id}/`

- Islev: products_partial_update
- OpenAPI operationId: `products_partial_update`
- Tag: `products`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this product. |
- Request body: `application/json`: `PatchedProduct`<br>`application/x-www-form-urlencoded`: `PatchedProduct`<br>`multipart/form-data`: `PatchedProduct`
- Response: `200` application/json: Product

#### `DELETE /api/products/{id}/`

- Islev: products_destroy
- OpenAPI operationId: `products_destroy`
- Tag: `products`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this product. |
- Request body: -
- Response: `204` No response body

#### `GET /api/purchase-orders/`

- Islev: purchase_orders_list
- OpenAPI operationId: `purchase_orders_list`
- Tag: `purchase-orders`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<PurchaseOrder>

#### `POST /api/purchase-orders/`

- Islev: purchase_orders_create
- OpenAPI operationId: `purchase_orders_create`
- Tag: `purchase-orders`
- Parametreler: Parametre yok.
- Request body: `application/json`: `PurchaseOrder`<br>`application/x-www-form-urlencoded`: `PurchaseOrder`<br>`multipart/form-data`: `PurchaseOrder` zorunlu
- Response: `201` application/json: PurchaseOrder

#### `GET /api/purchase-orders/{id}/`

- Islev: purchase_orders_retrieve
- OpenAPI operationId: `purchase_orders_retrieve`
- Tag: `purchase-orders`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this purchase order. |
- Request body: -
- Response: `200` application/json: PurchaseOrder

#### `PUT /api/purchase-orders/{id}/`

- Islev: purchase_orders_update
- OpenAPI operationId: `purchase_orders_update`
- Tag: `purchase-orders`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this purchase order. |
- Request body: `application/json`: `PurchaseOrder`<br>`application/x-www-form-urlencoded`: `PurchaseOrder`<br>`multipart/form-data`: `PurchaseOrder` zorunlu
- Response: `200` application/json: PurchaseOrder

#### `PATCH /api/purchase-orders/{id}/`

- Islev: purchase_orders_partial_update
- OpenAPI operationId: `purchase_orders_partial_update`
- Tag: `purchase-orders`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this purchase order. |
- Request body: `application/json`: `PatchedPurchaseOrder`<br>`application/x-www-form-urlencoded`: `PatchedPurchaseOrder`<br>`multipart/form-data`: `PatchedPurchaseOrder`
- Response: `200` application/json: PurchaseOrder

#### `DELETE /api/purchase-orders/{id}/`

- Islev: purchase_orders_destroy
- OpenAPI operationId: `purchase_orders_destroy`
- Tag: `purchase-orders`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this purchase order. |
- Request body: -
- Response: `204` No response body

#### `GET /api/sales-orders/`

- Islev: sales_orders_list
- OpenAPI operationId: `sales_orders_list`
- Tag: `sales-orders`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<SalesOrder>

#### `POST /api/sales-orders/`

- Islev: sales_orders_create
- OpenAPI operationId: `sales_orders_create`
- Tag: `sales-orders`
- Parametreler: Parametre yok.
- Request body: `application/json`: `SalesOrder`<br>`application/x-www-form-urlencoded`: `SalesOrder`<br>`multipart/form-data`: `SalesOrder` zorunlu
- Response: `201` application/json: SalesOrder

#### `GET /api/sales-orders/{id}/`

- Islev: sales_orders_retrieve
- OpenAPI operationId: `sales_orders_retrieve`
- Tag: `sales-orders`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this sales order. |
- Request body: -
- Response: `200` application/json: SalesOrder

#### `PUT /api/sales-orders/{id}/`

- Islev: sales_orders_update
- OpenAPI operationId: `sales_orders_update`
- Tag: `sales-orders`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this sales order. |
- Request body: `application/json`: `SalesOrder`<br>`application/x-www-form-urlencoded`: `SalesOrder`<br>`multipart/form-data`: `SalesOrder` zorunlu
- Response: `200` application/json: SalesOrder

#### `PATCH /api/sales-orders/{id}/`

- Islev: sales_orders_partial_update
- OpenAPI operationId: `sales_orders_partial_update`
- Tag: `sales-orders`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this sales order. |
- Request body: `application/json`: `PatchedSalesOrder`<br>`application/x-www-form-urlencoded`: `PatchedSalesOrder`<br>`multipart/form-data`: `PatchedSalesOrder`
- Response: `200` application/json: SalesOrder

#### `DELETE /api/sales-orders/{id}/`

- Islev: sales_orders_destroy
- OpenAPI operationId: `sales_orders_destroy`
- Tag: `sales-orders`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this sales order. |
- Request body: -
- Response: `204` No response body

#### `GET /api/stock-movements/`

- Islev: stock_movements_list
- OpenAPI operationId: `stock_movements_list`
- Tag: `stock-movements`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<StockMovement>

#### `POST /api/stock-movements/`

- Islev: stock_movements_create
- OpenAPI operationId: `stock_movements_create`
- Tag: `stock-movements`
- Parametreler: Parametre yok.
- Request body: `application/json`: `StockMovement`<br>`application/x-www-form-urlencoded`: `StockMovement`<br>`multipart/form-data`: `StockMovement` zorunlu
- Response: `201` application/json: StockMovement

#### `GET /api/stock-movements/{id}/`

- Islev: stock_movements_retrieve
- OpenAPI operationId: `stock_movements_retrieve`
- Tag: `stock-movements`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this stock movement. |
- Request body: -
- Response: `200` application/json: StockMovement

#### `PUT /api/stock-movements/{id}/`

- Islev: stock_movements_update
- OpenAPI operationId: `stock_movements_update`
- Tag: `stock-movements`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this stock movement. |
- Request body: `application/json`: `StockMovement`<br>`application/x-www-form-urlencoded`: `StockMovement`<br>`multipart/form-data`: `StockMovement` zorunlu
- Response: `200` application/json: StockMovement

#### `PATCH /api/stock-movements/{id}/`

- Islev: stock_movements_partial_update
- OpenAPI operationId: `stock_movements_partial_update`
- Tag: `stock-movements`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this stock movement. |
- Request body: `application/json`: `PatchedStockMovement`<br>`application/x-www-form-urlencoded`: `PatchedStockMovement`<br>`multipart/form-data`: `PatchedStockMovement`
- Response: `200` application/json: StockMovement

#### `DELETE /api/stock-movements/{id}/`

- Islev: stock_movements_destroy
- OpenAPI operationId: `stock_movements_destroy`
- Tag: `stock-movements`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this stock movement. |
- Request body: -
- Response: `204` No response body

#### `GET /api/vehicles/`

- Islev: vehicles_list
- OpenAPI operationId: `vehicles_list`
- Tag: `vehicles`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<Vehicle>

#### `POST /api/vehicles/`

- Islev: vehicles_create
- OpenAPI operationId: `vehicles_create`
- Tag: `vehicles`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Vehicle`<br>`application/x-www-form-urlencoded`: `Vehicle`<br>`multipart/form-data`: `Vehicle`
- Response: `201` application/json: Vehicle

#### `GET /api/vehicles/{id}/`

- Islev: vehicles_retrieve
- OpenAPI operationId: `vehicles_retrieve`
- Tag: `vehicles`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this vehicle. |
- Request body: -
- Response: `200` application/json: Vehicle

#### `PUT /api/vehicles/{id}/`

- Islev: vehicles_update
- OpenAPI operationId: `vehicles_update`
- Tag: `vehicles`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this vehicle. |
- Request body: `application/json`: `Vehicle`<br>`application/x-www-form-urlencoded`: `Vehicle`<br>`multipart/form-data`: `Vehicle`
- Response: `200` application/json: Vehicle

#### `PATCH /api/vehicles/{id}/`

- Islev: vehicles_partial_update
- OpenAPI operationId: `vehicles_partial_update`
- Tag: `vehicles`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this vehicle. |
- Request body: `application/json`: `PatchedVehicle`<br>`application/x-www-form-urlencoded`: `PatchedVehicle`<br>`multipart/form-data`: `PatchedVehicle`
- Response: `200` application/json: Vehicle

#### `DELETE /api/vehicles/{id}/`

- Islev: vehicles_destroy
- OpenAPI operationId: `vehicles_destroy`
- Tag: `vehicles`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this vehicle. |
- Request body: -
- Response: `204` No response body

### CRM: Cari, Lead, Firsat, Kisi

#### `GET /api/contacts/`

- Islev: contacts_list
- OpenAPI operationId: `contacts_list`
- Tag: `contacts`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<Contact>

#### `POST /api/contacts/`

- Islev: contacts_create
- OpenAPI operationId: `contacts_create`
- Tag: `contacts`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Contact`<br>`application/x-www-form-urlencoded`: `Contact`<br>`multipart/form-data`: `Contact`
- Response: `201` application/json: Contact

#### `GET /api/contacts/{id}/`

- Islev: contacts_retrieve
- OpenAPI operationId: `contacts_retrieve`
- Tag: `contacts`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this contact. |
- Request body: -
- Response: `200` application/json: Contact

#### `PUT /api/contacts/{id}/`

- Islev: contacts_update
- OpenAPI operationId: `contacts_update`
- Tag: `contacts`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this contact. |
- Request body: `application/json`: `Contact`<br>`application/x-www-form-urlencoded`: `Contact`<br>`multipart/form-data`: `Contact`
- Response: `200` application/json: Contact

#### `PATCH /api/contacts/{id}/`

- Islev: contacts_partial_update
- OpenAPI operationId: `contacts_partial_update`
- Tag: `contacts`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this contact. |
- Request body: `application/json`: `PatchedContact`<br>`application/x-www-form-urlencoded`: `PatchedContact`<br>`multipart/form-data`: `PatchedContact`
- Response: `200` application/json: Contact

#### `DELETE /api/contacts/{id}/`

- Islev: contacts_destroy
- OpenAPI operationId: `contacts_destroy`
- Tag: `contacts`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this contact. |
- Request body: -
- Response: `204` No response body

#### `GET /api/leads/`

- Islev: leads_list
- OpenAPI operationId: `leads_list`
- Tag: `leads`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<Lead>

#### `POST /api/leads/`

- Islev: leads_create
- OpenAPI operationId: `leads_create`
- Tag: `leads`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Lead`<br>`application/x-www-form-urlencoded`: `Lead`<br>`multipart/form-data`: `Lead` zorunlu
- Response: `201` application/json: Lead

#### `GET /api/leads/{id}/`

- Islev: leads_retrieve
- OpenAPI operationId: `leads_retrieve`
- Tag: `leads`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this lead. |
- Request body: -
- Response: `200` application/json: Lead

#### `PUT /api/leads/{id}/`

- Islev: leads_update
- OpenAPI operationId: `leads_update`
- Tag: `leads`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this lead. |
- Request body: `application/json`: `Lead`<br>`application/x-www-form-urlencoded`: `Lead`<br>`multipart/form-data`: `Lead` zorunlu
- Response: `200` application/json: Lead

#### `PATCH /api/leads/{id}/`

- Islev: leads_partial_update
- OpenAPI operationId: `leads_partial_update`
- Tag: `leads`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this lead. |
- Request body: `application/json`: `PatchedLead`<br>`application/x-www-form-urlencoded`: `PatchedLead`<br>`multipart/form-data`: `PatchedLead`
- Response: `200` application/json: Lead

#### `DELETE /api/leads/{id}/`

- Islev: leads_destroy
- OpenAPI operationId: `leads_destroy`
- Tag: `leads`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this lead. |
- Request body: -
- Response: `204` No response body

#### `GET /api/opportunities/`

- Islev: opportunities_list
- OpenAPI operationId: `opportunities_list`
- Tag: `opportunities`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<Opportunity>

#### `POST /api/opportunities/`

- Islev: opportunities_create
- OpenAPI operationId: `opportunities_create`
- Tag: `opportunities`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Opportunity`<br>`application/x-www-form-urlencoded`: `Opportunity`<br>`multipart/form-data`: `Opportunity`
- Response: `201` application/json: Opportunity

#### `GET /api/opportunities/{id}/`

- Islev: opportunities_retrieve
- OpenAPI operationId: `opportunities_retrieve`
- Tag: `opportunities`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this opportunity. |
- Request body: -
- Response: `200` application/json: Opportunity

#### `PUT /api/opportunities/{id}/`

- Islev: opportunities_update
- OpenAPI operationId: `opportunities_update`
- Tag: `opportunities`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this opportunity. |
- Request body: `application/json`: `Opportunity`<br>`application/x-www-form-urlencoded`: `Opportunity`<br>`multipart/form-data`: `Opportunity`
- Response: `200` application/json: Opportunity

#### `PATCH /api/opportunities/{id}/`

- Islev: opportunities_partial_update
- OpenAPI operationId: `opportunities_partial_update`
- Tag: `opportunities`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this opportunity. |
- Request body: `application/json`: `PatchedOpportunity`<br>`application/x-www-form-urlencoded`: `PatchedOpportunity`<br>`multipart/form-data`: `PatchedOpportunity`
- Response: `200` application/json: Opportunity

#### `DELETE /api/opportunities/{id}/`

- Islev: opportunities_destroy
- OpenAPI operationId: `opportunities_destroy`
- Tag: `opportunities`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this opportunity. |
- Request body: -
- Response: `204` No response body

#### `GET /api/partners/`

- Islev: partners_list
- OpenAPI operationId: `partners_list`
- Tag: `partners`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<BusinessPartner>

#### `POST /api/partners/`

- Islev: partners_create
- OpenAPI operationId: `partners_create`
- Tag: `partners`
- Parametreler: Parametre yok.
- Request body: `application/json`: `BusinessPartner`<br>`application/x-www-form-urlencoded`: `BusinessPartner`<br>`multipart/form-data`: `BusinessPartner`
- Response: `201` application/json: BusinessPartner

#### `GET /api/partners/{id}/`

- Islev: partners_retrieve
- OpenAPI operationId: `partners_retrieve`
- Tag: `partners`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this business partner. |
- Request body: -
- Response: `200` application/json: BusinessPartner

#### `PUT /api/partners/{id}/`

- Islev: partners_update
- OpenAPI operationId: `partners_update`
- Tag: `partners`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this business partner. |
- Request body: `application/json`: `BusinessPartner`<br>`application/x-www-form-urlencoded`: `BusinessPartner`<br>`multipart/form-data`: `BusinessPartner`
- Response: `200` application/json: BusinessPartner

#### `PATCH /api/partners/{id}/`

- Islev: partners_partial_update
- OpenAPI operationId: `partners_partial_update`
- Tag: `partners`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this business partner. |
- Request body: `application/json`: `PatchedBusinessPartner`<br>`application/x-www-form-urlencoded`: `PatchedBusinessPartner`<br>`multipart/form-data`: `PatchedBusinessPartner`
- Response: `200` application/json: BusinessPartner

#### `DELETE /api/partners/{id}/`

- Islev: partners_destroy
- OpenAPI operationId: `partners_destroy`
- Tag: `partners`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this business partner. |
- Request body: -
- Response: `204` No response body

### Teklif / Sozlesme / Satici Firma / Sablon

#### `GET /api/pricing-rules/`

- Islev: pricing_rules_list
- OpenAPI operationId: `pricing_rules_list`
- Tag: `pricing-rules`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<PricingRule>

#### `POST /api/pricing-rules/`

- Islev: pricing_rules_create
- OpenAPI operationId: `pricing_rules_create`
- Tag: `pricing-rules`
- Parametreler: Parametre yok.
- Request body: `application/json`: `PricingRule`<br>`application/x-www-form-urlencoded`: `PricingRule`<br>`multipart/form-data`: `PricingRule` zorunlu
- Response: `201` application/json: PricingRule

#### `GET /api/pricing-rules/{id}/`

- Islev: pricing_rules_retrieve
- OpenAPI operationId: `pricing_rules_retrieve`
- Tag: `pricing-rules`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this pricing rule. |
- Request body: -
- Response: `200` application/json: PricingRule

#### `PUT /api/pricing-rules/{id}/`

- Islev: pricing_rules_update
- OpenAPI operationId: `pricing_rules_update`
- Tag: `pricing-rules`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this pricing rule. |
- Request body: `application/json`: `PricingRule`<br>`application/x-www-form-urlencoded`: `PricingRule`<br>`multipart/form-data`: `PricingRule` zorunlu
- Response: `200` application/json: PricingRule

#### `PATCH /api/pricing-rules/{id}/`

- Islev: pricing_rules_partial_update
- OpenAPI operationId: `pricing_rules_partial_update`
- Tag: `pricing-rules`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this pricing rule. |
- Request body: `application/json`: `PatchedPricingRule`<br>`application/x-www-form-urlencoded`: `PatchedPricingRule`<br>`multipart/form-data`: `PatchedPricingRule`
- Response: `200` application/json: PricingRule

#### `DELETE /api/pricing-rules/{id}/`

- Islev: pricing_rules_destroy
- OpenAPI operationId: `pricing_rules_destroy`
- Tag: `pricing-rules`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this pricing rule. |
- Request body: -
- Response: `204` No response body

#### `GET /api/quotes/`

- Islev: quotes_list
- OpenAPI operationId: `quotes_list`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<Quote>

#### `POST /api/quotes/`

- Islev: quotes_create
- OpenAPI operationId: `quotes_create`
- Tag: `quotes`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `201` application/json: Quote

#### `POST /api/quotes/apply_preview/`

- Islev: Apply pricing rules server-side and return recalculated totals for preview.
- OpenAPI operationId: `quotes_apply_preview_create`
- Tag: `quotes`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `200` application/json: Quote

#### `GET /api/quotes/template-library-download/`

- Islev: quotes_template_library_download_retrieve
- OpenAPI operationId: `quotes_template_library_download_retrieve`
- Tag: `quotes`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Quote

#### `POST /api/quotes/template-library-upload/`

- Islev: Firma bazli Excel sablonu yukler. multipart/form-data kullanilir.
- OpenAPI operationId: `quotes_template_library_upload_create`
- Tag: `quotes`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `200` application/json: Quote

#### `GET /api/quotes/template-library/`

- Islev: quotes_template_library_retrieve
- OpenAPI operationId: `quotes_template_library_retrieve`
- Tag: `quotes`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Quote

#### `GET /api/quotes/template-placeholders/`

- Islev: quotes_template_placeholders_retrieve
- OpenAPI operationId: `quotes_template_placeholders_retrieve`
- Tag: `quotes`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Quote

#### `GET /api/quotes/{id}/`

- Islev: quotes_retrieve
- OpenAPI operationId: `quotes_retrieve`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: -
- Response: `200` application/json: Quote

#### `PUT /api/quotes/{id}/`

- Islev: quotes_update
- OpenAPI operationId: `quotes_update`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `200` application/json: Quote

#### `PATCH /api/quotes/{id}/`

- Islev: quotes_partial_update
- OpenAPI operationId: `quotes_partial_update`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: `application/json`: `PatchedQuote`<br>`application/x-www-form-urlencoded`: `PatchedQuote`<br>`multipart/form-data`: `PatchedQuote`
- Response: `200` application/json: Quote

#### `DELETE /api/quotes/{id}/`

- Islev: quotes_destroy
- OpenAPI operationId: `quotes_destroy`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: -
- Response: `204` No response body

#### `POST /api/quotes/{id}/approve/`

- Islev: quotes_approve_create
- OpenAPI operationId: `quotes_approve_create`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `200` application/json: Quote

#### `POST /api/quotes/{id}/convert/`

- Islev: quotes_convert_create
- OpenAPI operationId: `quotes_convert_create`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `200` application/json: Quote

#### `GET /api/quotes/{id}/export-excel/`

- Islev: Belgeyi duzenlenebilir Excel olarak indirir; web sablon yonetimi icin korunur.
- OpenAPI operationId: `quotes_export_excel_retrieve`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: -
- Response: `200` application/json: Quote

#### `GET /api/quotes/{id}/export-files/`

- Islev: quotes_export_files_retrieve
- OpenAPI operationId: `quotes_export_files_retrieve`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: -
- Response: `200` application/json: Quote

#### `GET /api/quotes/{id}/export-pdf/`

- Islev: Belgeyi PDF olarak indirir; dosya adi belge numarasidir.
- OpenAPI operationId: `quotes_export_pdf_retrieve`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: -
- Response: `200` application/json: Quote

#### `GET /api/quotes/{id}/export-xlsx/`

- Islev: Geriye uyumluluk rotasidir; artik PDF dondurur.
- OpenAPI operationId: `quotes_export_xlsx_retrieve`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: -
- Response: `200` application/json: Quote

#### `POST /api/quotes/{id}/reject/`

- Islev: quotes_reject_create
- OpenAPI operationId: `quotes_reject_create`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `200` application/json: Quote

#### `POST /api/quotes/{id}/request_approval/`

- Islev: quotes_request_approval_create
- OpenAPI operationId: `quotes_request_approval_create`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `200` application/json: Quote

#### `POST /api/quotes/{id}/resubmit/`

- Islev: quotes_resubmit_create
- OpenAPI operationId: `quotes_resubmit_create`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `200` application/json: Quote

#### `POST /api/quotes/{id}/send/`

- Islev: quotes_send_create
- OpenAPI operationId: `quotes_send_create`
- Tag: `quotes`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this quote. |
- Request body: `application/json`: `Quote`<br>`application/x-www-form-urlencoded`: `Quote`<br>`multipart/form-data`: `Quote` zorunlu
- Response: `200` application/json: Quote

#### `GET /api/seller-companies/`

- Islev: seller_companies_retrieve
- OpenAPI operationId: `seller_companies_retrieve`
- Tag: `seller-companies`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

#### `POST /api/seller-companies/`

- Islev: seller_companies_create
- OpenAPI operationId: `seller_companies_create`
- Tag: `seller-companies`
- Parametreler: Parametre yok.
- Request body: -
- Response: `201` No response body

#### `PATCH /api/seller-companies/{id}/`

- Islev: seller_companies_partial_update
- OpenAPI operationId: `seller_companies_partial_update`
- Tag: `seller-companies`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: -
- Response: `200` No response body

#### `DELETE /api/seller-companies/{id}/`

- Islev: seller_companies_destroy
- OpenAPI operationId: `seller_companies_destroy`
- Tag: `seller-companies`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: -
- Response: `204` No response body

#### `POST /api/seller-companies/{id}/upload-logo/`

- Islev: Satici firma logosu yukler. PNG/JPG/JPEG/SVG desteklenir.
- OpenAPI operationId: `seller_companies_upload_logo_create`
- Tag: `seller-companies`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `string` |  |
- Request body: -
- Response: `200` No response body

### Ekipler

#### `GET /api/team-associates/`

- Islev: Hesapsiz ekip calisanlari (CRUD).
- OpenAPI operationId: `team_associates_list`
- Tag: `team-associates`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<TeamAssociate>

#### `POST /api/team-associates/`

- Islev: Hesapsiz ekip calisanlari (CRUD).
- OpenAPI operationId: `team_associates_create`
- Tag: `team-associates`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TeamAssociate`<br>`application/x-www-form-urlencoded`: `TeamAssociate`<br>`multipart/form-data`: `TeamAssociate` zorunlu
- Response: `201` application/json: TeamAssociate

#### `GET /api/team-associates/{id}/`

- Islev: Hesapsiz ekip calisanlari (CRUD).
- OpenAPI operationId: `team_associates_retrieve`
- Tag: `team-associates`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this team associate. |
- Request body: -
- Response: `200` application/json: TeamAssociate

#### `PUT /api/team-associates/{id}/`

- Islev: Hesapsiz ekip calisanlari (CRUD).
- OpenAPI operationId: `team_associates_update`
- Tag: `team-associates`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this team associate. |
- Request body: `application/json`: `TeamAssociate`<br>`application/x-www-form-urlencoded`: `TeamAssociate`<br>`multipart/form-data`: `TeamAssociate` zorunlu
- Response: `200` application/json: TeamAssociate

#### `PATCH /api/team-associates/{id}/`

- Islev: Hesapsiz ekip calisanlari (CRUD).
- OpenAPI operationId: `team_associates_partial_update`
- Tag: `team-associates`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this team associate. |
- Request body: `application/json`: `PatchedTeamAssociate`<br>`application/x-www-form-urlencoded`: `PatchedTeamAssociate`<br>`multipart/form-data`: `PatchedTeamAssociate`
- Response: `200` application/json: TeamAssociate

#### `DELETE /api/team-associates/{id}/`

- Islev: Hesapsiz ekip calisanlari (CRUD).
- OpenAPI operationId: `team_associates_destroy`
- Tag: `team-associates`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this team associate. |
- Request body: -
- Response: `204` No response body

#### `GET /api/teams/`

- Islev: teams_list
- OpenAPI operationId: `teams_list`
- Tag: `teams`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<Team>

#### `POST /api/teams/`

- Islev: teams_create
- OpenAPI operationId: `teams_create`
- Tag: `teams`
- Parametreler: Parametre yok.
- Request body: `application/json`: `Team`<br>`application/x-www-form-urlencoded`: `Team`<br>`multipart/form-data`: `Team` zorunlu
- Response: `201` application/json: Team

#### `GET /api/teams/{id}/`

- Islev: teams_retrieve
- OpenAPI operationId: `teams_retrieve`
- Tag: `teams`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this team. |
- Request body: -
- Response: `200` application/json: Team

#### `PUT /api/teams/{id}/`

- Islev: teams_update
- OpenAPI operationId: `teams_update`
- Tag: `teams`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this team. |
- Request body: `application/json`: `Team`<br>`application/x-www-form-urlencoded`: `Team`<br>`multipart/form-data`: `Team` zorunlu
- Response: `200` application/json: Team

#### `PATCH /api/teams/{id}/`

- Islev: teams_partial_update
- OpenAPI operationId: `teams_partial_update`
- Tag: `teams`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this team. |
- Request body: `application/json`: `PatchedTeam`<br>`application/x-www-form-urlencoded`: `PatchedTeam`<br>`multipart/form-data`: `PatchedTeam`
- Response: `200` application/json: Team

#### `DELETE /api/teams/{id}/`

- Islev: teams_destroy
- OpenAPI operationId: `teams_destroy`
- Tag: `teams`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this team. |
- Request body: -
- Response: `204` No response body

### Public Website ve SaaS Admin

#### `GET /api/v1/admin/blog/`

- Islev: Admin blog API - superadmin only. Full CRUD for blog posts.
- OpenAPI operationId: `v1_admin_blog_list`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `author` | `query` | Hayir | `integer` |  |
| `category` | `query` | Hayir | `integer` |  |
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
| `status` | `query` | Hayir | `string` | * `draft` - Draft * `published` - Published |
- Request body: -
- Response: `200` application/json: Array<BlogPostAdmin>

#### `POST /api/v1/admin/blog/`

- Islev: Admin blog API - superadmin only. Full CRUD for blog posts.
- OpenAPI operationId: `v1_admin_blog_create`
- Tag: `v1`
- Parametreler: Parametre yok.
- Request body: `application/json`: `BlogPostAdmin`<br>`application/x-www-form-urlencoded`: `BlogPostAdmin`<br>`multipart/form-data`: `BlogPostAdmin` zorunlu
- Response: `201` application/json: BlogPostAdmin

#### `GET /api/v1/admin/blog/{id}/`

- Islev: Admin blog API - superadmin only. Full CRUD for blog posts.
- OpenAPI operationId: `v1_admin_blog_retrieve`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this blog post. |
- Request body: -
- Response: `200` application/json: BlogPostAdmin

#### `PUT /api/v1/admin/blog/{id}/`

- Islev: Admin blog API - superadmin only. Full CRUD for blog posts.
- OpenAPI operationId: `v1_admin_blog_update`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this blog post. |
- Request body: `application/json`: `BlogPostAdmin`<br>`application/x-www-form-urlencoded`: `BlogPostAdmin`<br>`multipart/form-data`: `BlogPostAdmin` zorunlu
- Response: `200` application/json: BlogPostAdmin

#### `PATCH /api/v1/admin/blog/{id}/`

- Islev: Admin blog API - superadmin only. Full CRUD for blog posts.
- OpenAPI operationId: `v1_admin_blog_partial_update`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this blog post. |
- Request body: `application/json`: `PatchedBlogPostAdmin`<br>`application/x-www-form-urlencoded`: `PatchedBlogPostAdmin`<br>`multipart/form-data`: `PatchedBlogPostAdmin`
- Response: `200` application/json: BlogPostAdmin

#### `DELETE /api/v1/admin/blog/{id}/`

- Islev: Admin blog API - superadmin only. Full CRUD for blog posts.
- OpenAPI operationId: `v1_admin_blog_destroy`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this blog post. |
- Request body: -
- Response: `204` No response body

#### `POST /api/v1/admin/blog/{id}/publish/`

- Islev: Publish a draft post
- OpenAPI operationId: `v1_admin_blog_publish_create`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this blog post. |
- Request body: `application/json`: `BlogPostAdmin`<br>`application/x-www-form-urlencoded`: `BlogPostAdmin`<br>`multipart/form-data`: `BlogPostAdmin` zorunlu
- Response: `200` application/json: BlogPostAdmin

#### `POST /api/v1/admin/blog/{id}/unpublish/`

- Islev: Unpublish a post
- OpenAPI operationId: `v1_admin_blog_unpublish_create`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this blog post. |
- Request body: `application/json`: `BlogPostAdmin`<br>`application/x-www-form-urlencoded`: `BlogPostAdmin`<br>`multipart/form-data`: `BlogPostAdmin` zorunlu
- Response: `200` application/json: BlogPostAdmin

#### `GET /api/v1/admin/contact/`

- Islev: Admin contact submissions API - superadmin only. View and manage contact form submissions.
- OpenAPI operationId: `v1_admin_contact_list`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `status` | `query` | Hayir | `string` | * `new` - New * `contacted` - Contacted * `converted` - Converted * `closed` - Closed |
- Request body: -
- Response: `200` application/json: Array<ContactSubmissionAdmin>

#### `GET /api/v1/admin/contact/{id}/`

- Islev: Admin contact submissions API - superadmin only. View and manage contact form submissions.
- OpenAPI operationId: `v1_admin_contact_retrieve`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this contact submission. |
- Request body: -
- Response: `200` application/json: ContactSubmissionAdmin

#### `PATCH /api/v1/admin/contact/{id}/`

- Islev: Admin contact submissions API - superadmin only. View and manage contact form submissions.
- OpenAPI operationId: `v1_admin_contact_partial_update`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this contact submission. |
- Request body: `application/json`: `PatchedContactSubmissionAdmin`<br>`application/x-www-form-urlencoded`: `PatchedContactSubmissionAdmin`<br>`multipart/form-data`: `PatchedContactSubmissionAdmin`
- Response: `200` application/json: ContactSubmissionAdmin

#### `GET /api/v1/admin/plans/`

- Islev: Admin plan management API - superadmin only. CRUD for subscription plans.
- OpenAPI operationId: `v1_admin_plans_list`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `is_active` | `query` | Hayir | `boolean` |  |
| `plan_type` | `query` | Hayir | `string` | * `starter` - Starter * `professional` - Professional * `enterprise` - Enterprise |
- Request body: -
- Response: `200` application/json: Array<TenantPlan>

#### `POST /api/v1/admin/plans/`

- Islev: Admin plan management API - superadmin only. CRUD for subscription plans.
- OpenAPI operationId: `v1_admin_plans_create`
- Tag: `v1`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TenantPlan`<br>`application/x-www-form-urlencoded`: `TenantPlan`<br>`multipart/form-data`: `TenantPlan` zorunlu
- Response: `201` application/json: TenantPlan

#### `GET /api/v1/admin/plans/{id}/`

- Islev: Admin plan management API - superadmin only. CRUD for subscription plans.
- OpenAPI operationId: `v1_admin_plans_retrieve`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this tenant plan. |
- Request body: -
- Response: `200` application/json: TenantPlan

#### `PUT /api/v1/admin/plans/{id}/`

- Islev: Admin plan management API - superadmin only. CRUD for subscription plans.
- OpenAPI operationId: `v1_admin_plans_update`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this tenant plan. |
- Request body: `application/json`: `TenantPlan`<br>`application/x-www-form-urlencoded`: `TenantPlan`<br>`multipart/form-data`: `TenantPlan` zorunlu
- Response: `200` application/json: TenantPlan

#### `PATCH /api/v1/admin/plans/{id}/`

- Islev: Admin plan management API - superadmin only. CRUD for subscription plans.
- OpenAPI operationId: `v1_admin_plans_partial_update`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this tenant plan. |
- Request body: `application/json`: `PatchedTenantPlan`<br>`application/x-www-form-urlencoded`: `PatchedTenantPlan`<br>`multipart/form-data`: `PatchedTenantPlan`
- Response: `200` application/json: TenantPlan

#### `DELETE /api/v1/admin/plans/{id}/`

- Islev: Admin plan management API - superadmin only. CRUD for subscription plans.
- OpenAPI operationId: `v1_admin_plans_destroy`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this tenant plan. |
- Request body: -
- Response: `204` No response body

#### `GET /api/v1/admin/subscriptions/`

- Islev: Admin subscription management API - superadmin only. CRUD for tenant subscriptions.
- OpenAPI operationId: `v1_admin_subscriptions_list`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `billing_cycle` | `query` | Hayir | `string` | * `monthly` - Monthly * `yearly` - Yearly |
| `status` | `query` | Hayir | `string` | * `trial` - Trial * `active` - Active * `suspended` - Suspended * `cancelled` - Cancelled |
- Request body: -
- Response: `200` application/json: Array<TenantSubscription>

#### `POST /api/v1/admin/subscriptions/`

- Islev: Admin subscription management API - superadmin only. CRUD for tenant subscriptions.
- OpenAPI operationId: `v1_admin_subscriptions_create`
- Tag: `v1`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TenantSubscription`<br>`application/x-www-form-urlencoded`: `TenantSubscription`<br>`multipart/form-data`: `TenantSubscription` zorunlu
- Response: `201` application/json: TenantSubscription

#### `GET /api/v1/admin/subscriptions/{id}/`

- Islev: Admin subscription management API - superadmin only. CRUD for tenant subscriptions.
- OpenAPI operationId: `v1_admin_subscriptions_retrieve`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this tenant subscription. |
- Request body: -
- Response: `200` application/json: TenantSubscription

#### `PUT /api/v1/admin/subscriptions/{id}/`

- Islev: Admin subscription management API - superadmin only. CRUD for tenant subscriptions.
- OpenAPI operationId: `v1_admin_subscriptions_update`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this tenant subscription. |
- Request body: `application/json`: `TenantSubscription`<br>`application/x-www-form-urlencoded`: `TenantSubscription`<br>`multipart/form-data`: `TenantSubscription` zorunlu
- Response: `200` application/json: TenantSubscription

#### `PATCH /api/v1/admin/subscriptions/{id}/`

- Islev: Admin subscription management API - superadmin only. CRUD for tenant subscriptions.
- OpenAPI operationId: `v1_admin_subscriptions_partial_update`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this tenant subscription. |
- Request body: `application/json`: `PatchedTenantSubscription`<br>`application/x-www-form-urlencoded`: `PatchedTenantSubscription`<br>`multipart/form-data`: `PatchedTenantSubscription`
- Response: `200` application/json: TenantSubscription

#### `DELETE /api/v1/admin/subscriptions/{id}/`

- Islev: Admin subscription management API - superadmin only. CRUD for tenant subscriptions.
- OpenAPI operationId: `v1_admin_subscriptions_destroy`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this tenant subscription. |
- Request body: -
- Response: `204` No response body

#### `GET /api/v1/admin/tenants/`

- Islev: Admin tenant management API - superadmin only. CRUD for organizations/tenants.
- OpenAPI operationId: `v1_admin_tenants_list`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `code` | `query` | Hayir | `string` |  |
- Request body: -
- Response: `200` application/json: Array<TenantDetail>

#### `POST /api/v1/admin/tenants/`

- Islev: Admin tenant management API - superadmin only. CRUD for organizations/tenants.
- OpenAPI operationId: `v1_admin_tenants_create`
- Tag: `v1`
- Parametreler: Parametre yok.
- Request body: `application/json`: `TenantDetail`<br>`application/x-www-form-urlencoded`: `TenantDetail`<br>`multipart/form-data`: `TenantDetail` zorunlu
- Response: `201` application/json: TenantDetail

#### `GET /api/v1/admin/tenants/{id}/`

- Islev: Admin tenant management API - superadmin only. CRUD for organizations/tenants.
- OpenAPI operationId: `v1_admin_tenants_retrieve`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this organization. |
- Request body: -
- Response: `200` application/json: TenantDetail

#### `PUT /api/v1/admin/tenants/{id}/`

- Islev: Admin tenant management API - superadmin only. CRUD for organizations/tenants.
- OpenAPI operationId: `v1_admin_tenants_update`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this organization. |
- Request body: `application/json`: `TenantDetail`<br>`application/x-www-form-urlencoded`: `TenantDetail`<br>`multipart/form-data`: `TenantDetail` zorunlu
- Response: `200` application/json: TenantDetail

#### `PATCH /api/v1/admin/tenants/{id}/`

- Islev: Admin tenant management API - superadmin only. CRUD for organizations/tenants.
- OpenAPI operationId: `v1_admin_tenants_partial_update`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this organization. |
- Request body: `application/json`: `PatchedTenantDetail`<br>`application/x-www-form-urlencoded`: `PatchedTenantDetail`<br>`multipart/form-data`: `PatchedTenantDetail`
- Response: `200` application/json: TenantDetail

#### `DELETE /api/v1/admin/tenants/{id}/`

- Islev: Admin tenant management API - superadmin only. CRUD for organizations/tenants.
- OpenAPI operationId: `v1_admin_tenants_destroy`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this organization. |
- Request body: -
- Response: `204` No response body

#### `GET /api/v1/admin/tenants/{id}/users/`

- Islev: Get all users for a tenant
- OpenAPI operationId: `v1_admin_tenants_users_retrieve`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `id` | `path` | Evet | `integer` | A unique integer value identifying this organization. |
- Request body: -
- Response: `200` application/json: TenantDetail

#### `GET /api/v1/blog-categories/`

- Islev: Public blog categories
- OpenAPI operationId: `v1_blog_categories_list`
- Tag: `v1`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` application/json: Array<BlogCategory>

#### `GET /api/v1/blog-categories/{slug}/`

- Islev: Public blog categories
- OpenAPI operationId: `v1_blog_categories_retrieve`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `slug` | `path` | Evet | `string` |  |
- Request body: -
- Response: `200` application/json: BlogCategory

#### `GET /api/v1/blog/`

- Islev: Public blog API - no authentication required. Only shows published posts.
- OpenAPI operationId: `v1_blog_list`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `category` | `query` | Hayir | `integer` |  |
| `ordering` | `query` | Hayir | `string` | Which field to use when ordering the results. |
| `search` | `query` | Hayir | `string` | A search term. |
- Request body: -
- Response: `200` application/json: Array<BlogPostList>

#### `GET /api/v1/blog/{slug}/`

- Islev: Increment view count on detail view
- OpenAPI operationId: `v1_blog_retrieve`
- Tag: `v1`
- Parametreler:
| Ad | Konum | Zorunlu | Tip | Aciklama |
|---|---|---:|---|---|
| `slug` | `path` | Evet | `string` |  |
- Request body: -
- Response: `200` application/json: BlogPostDetail

#### `POST /api/v1/contact/`

- Islev: Public contact form submission. Rate limited to prevent spam.
- OpenAPI operationId: `v1_contact_create`
- Tag: `v1`
- Parametreler: Parametre yok.
- Request body: -
- Response: `200` No response body

## Veri Semalari / Serializer Alanlari

### `ActionEnum`
* `add_comment` - Add comment * `set_assignee` - Set assignee * `notify` - Notify * `multi_notify` - Notify multiple * `add_tag` - Add tag * `set_field` - Set field

Enum degerleri: `add_comment`, `set_assignee`, `notify`, `multi_notify`, `add_tag`, `set_field`

### `ApprovalInstance`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `quote` | `integer` | Evet | Hayir |  |
| `quote_number` | `string` | Evet | Evet |  |
| `status` | `string` | Hayir | Hayir | maxLength=20 |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `steps` | `Array<ApprovalStep>` | Evet | Evet |  |

### `ApprovalStep`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `role` | `string` | Evet | Hayir | maxLength=20 |
| `status` | `string` | Hayir | Hayir | maxLength=20 |
| `comment` | `string` | Hayir | Hayir |  |
| `acted_by` | `integer` | Hayir | Hayir |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |

### `AuditLog`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `entity` | `string` | Evet | Hayir | maxLength=50 |
| `entity_id` | `string` | Evet | Hayir | maxLength=50 |
| `action` | `string` | Evet | Hayir | maxLength=20 |
| `field` | `string` | Hayir | Hayir | maxLength=120 |
| `old_value` | `string` | Hayir | Hayir |  |
| `new_value` | `string` | Hayir | Hayir |  |
| `user` | `integer` | Hayir | Hayir |  |
| `user_name` | `string` | Evet | Evet |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |

### `AutomationRule`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Evet | Hayir | maxLength=255 |
| `trigger` | `TriggerEnum` | Evet | Hayir |  |
| `condition` | `-` | Hayir | Hayir |  |
| `action` | `ActionEnum` | Evet | Hayir |  |
| `action_payload` | `-` | Hayir | Hayir |  |
| `is_active` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `organization` | `integer` | Evet | Evet |  |

### `BillingCycleEnum`
* `monthly` - Monthly * `yearly` - Yearly

Enum degerleri: `monthly`, `yearly`

### `BlogCategory`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Evet | Hayir | maxLength=100 |
| `slug` | `string` | Evet | Hayir | maxLength=50 |
| `description` | `string` | Hayir | Hayir |  |

### `BlogPostAdmin`
Admin serializer with all fields

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `title` | `string` | Evet | Hayir | maxLength=200 |
| `slug` | `string` | Evet | Hayir | maxLength=50 |
| `excerpt` | `string` | Evet | Hayir | Short summary for list view |
| `content` | `string` | Evet | Hayir | Full blog post content (Markdown supported) |
| `featured_image` | `string(uri)` | Hayir | Hayir | maxLength=200 |
| `status` | `Status68aEnum` | Hayir | Hayir |  |
| `published_at` | `string(date-time)` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |
| `views` | `integer` | Evet | Evet |  |
| `tags` | `-` | Hayir | Hayir | List of tag strings |
| `meta_description` | `string` | Hayir | Hayir | SEO meta description; maxLength=160 |
| `category` | `integer` | Hayir | Hayir |  |
| `author` | `integer` | Evet | Hayir |  |

### `BlogPostDetail`
Full serializer for blog detail

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `title` | `string` | Evet | Hayir | maxLength=200 |
| `slug` | `string` | Evet | Hayir | maxLength=50 |
| `excerpt` | `string` | Evet | Hayir | Short summary for list view |
| `content` | `string` | Evet | Hayir | Full blog post content (Markdown supported) |
| `featured_image` | `string(uri)` | Hayir | Hayir | maxLength=200 |
| `author_name` | `string` | Evet | Evet |  |
| `category` | `integer` | Hayir | Hayir |  |
| `category_name` | `string` | Evet | Evet |  |
| `status` | `Status68aEnum` | Hayir | Hayir |  |
| `published_at` | `string(date-time)` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |
| `views` | `integer` | Hayir | Hayir |  |
| `tags` | `-` | Hayir | Hayir | List of tag strings |
| `meta_description` | `string` | Hayir | Hayir | SEO meta description; maxLength=160 |

### `BlogPostList`
Lightweight serializer for blog list

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `title` | `string` | Evet | Hayir | maxLength=200 |
| `slug` | `string` | Evet | Hayir | maxLength=50 |
| `excerpt` | `string` | Evet | Hayir | Short summary for list view |
| `featured_image` | `string(uri)` | Hayir | Hayir | maxLength=200 |
| `author_name` | `string` | Evet | Evet |  |
| `category_name` | `string` | Evet | Evet |  |
| `published_at` | `string(date-time)` | Hayir | Hayir |  |
| `views` | `integer` | Hayir | Hayir |  |
| `tags` | `-` | Hayir | Hayir | List of tag strings |

### `BusinessPartner`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `email` | `string(email)` | Hayir | Hayir | maxLength=254 |
| `phone` | `string` | Hayir | Hayir | maxLength=50 |
| `address` | `string` | Hayir | Hayir |  |
| `city` | `string` | Hayir | Hayir | maxLength=100 |
| `country` | `string` | Hayir | Hayir | maxLength=50 |
| `currency` | `string` | Hayir | Hayir | maxLength=10 |
| `size` | `string` | Hayir | Hayir | maxLength=50 |
| `tax_office` | `string` | Hayir | Hayir | maxLength=100 |
| `tax_number` | `string` | Hayir | Hayir | maxLength=64 |
| `authorized_person` | `string` | Hayir | Hayir | maxLength=255 |
| `group` | `string` | Hayir | Hayir | maxLength=50 |
| `organization` | `integer` | Hayir | Hayir |  |

### `Category`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `name` | `string` | Hayir | Hayir | maxLength=100 |
| `template_defaults` | `-` | Hayir | Hayir |  |
| `attribute_schema` | `-` | Hayir | Hayir |  |

### `Contact`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `role` | `string` | Hayir | Hayir | maxLength=128 |
| `email` | `string(email)` | Hayir | Hayir | maxLength=254 |
| `phone` | `string` | Hayir | Hayir | maxLength=64 |
| `owner` | `string` | Hayir | Hayir | maxLength=128 |
| `organization` | `integer` | Hayir | Hayir |  |
| `company` | `integer` | Hayir | Hayir |  |

### `ContactSubmissionAdmin`
Admin serializer with all fields

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Evet | Hayir | maxLength=100 |
| `email` | `string(email)` | Evet | Hayir | maxLength=254 |
| `company` | `string` | Hayir | Hayir | maxLength=100 |
| `phone` | `string` | Hayir | Hayir | maxLength=20 |
| `message` | `string` | Evet | Hayir |  |
| `status` | `ContactSubmissionAdminStatusEnum` | Hayir | Hayir |  |
| `ip_address` | `string` | Evet | Evet |  |
| `user_agent` | `string` | Evet | Evet |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |
| `notes` | `string` | Hayir | Hayir | Internal notes |

### `ContactSubmissionAdminStatusEnum`
* `new` - New * `contacted` - Contacted * `converted` - Converted * `closed` - Closed

Enum degerleri: `new`, `contacted`, `converted`, `closed`

### `DocumentTypeEnum`
* `Quote` - Quote * `Contract` - Contract

Enum degerleri: `Quote`, `Contract`

### `Invoice`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `number` | `string` | Evet | Evet |  |
| `customer_name` | `string` | Evet | Hayir | maxLength=255 |
| `status` | `InvoiceStatusEnum` | Hayir | Hayir |  |
| `amount` | `string(decimal)` | Hayir | Hayir |  |
| `currency` | `string` | Hayir | Hayir | maxLength=10 |
| `due_date` | `string(date)` | Hayir | Hayir |  |
| `issued_at` | `string(date)` | Hayir | Hayir |  |
| `payments` | `Array<InvoicePayment>` | Hayir | Hayir |  |

### `InvoicePayment`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `date` | `string(date)` | Evet | Hayir |  |
| `amount` | `string(decimal)` | Evet | Hayir |  |
| `method` | `string` | Hayir | Hayir | maxLength=50 |

### `InvoiceStatusEnum`
* `Draft` - Draft * `Sent` - Sent * `Paid` - Paid * `Overdue` - Overdue

Enum degerleri: `Draft`, `Sent`, `Paid`, `Overdue`

### `Lead`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Evet | Hayir | maxLength=255 |
| `title` | `string` | Hayir | Hayir | maxLength=120 |
| `status` | `string` | Hayir | Hayir | maxLength=50 |
| `source` | `string` | Hayir | Hayir | maxLength=50 |
| `score` | `integer` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `organization` | `integer` | Evet | Hayir |  |
| `company` | `integer` | Hayir | Hayir |  |
| `owner` | `integer` | Hayir | Hayir |  |

### `ModeEnum`
* `manual` - manual * `fixed` - fixed

Enum degerleri: `manual`, `fixed`

### `MovementTypeEnum`
* `IN` - IN * `OUT` - OUT * `TRANSFER` - TRANSFER

Enum degerleri: `IN`, `OUT`, `TRANSFER`

### `Opportunity`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `stage` | `string` | Hayir | Hayir | maxLength=50 |
| `value` | `string(decimal)` | Hayir | Hayir |  |
| `close_date` | `string(date)` | Hayir | Hayir |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `lead` | `integer` | Hayir | Hayir |  |
| `company` | `integer` | Hayir | Hayir |  |
| `owner` | `integer` | Hayir | Hayir |  |

### `PatchedAutomationRule`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `trigger` | `TriggerEnum` | Hayir | Hayir |  |
| `condition` | `-` | Hayir | Hayir |  |
| `action` | `ActionEnum` | Hayir | Hayir |  |
| `action_payload` | `-` | Hayir | Hayir |  |
| `is_active` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `organization` | `integer` | Hayir | Evet |  |

### `PatchedBlogPostAdmin`
Admin serializer with all fields

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `title` | `string` | Hayir | Hayir | maxLength=200 |
| `slug` | `string` | Hayir | Hayir | maxLength=50 |
| `excerpt` | `string` | Hayir | Hayir | Short summary for list view |
| `content` | `string` | Hayir | Hayir | Full blog post content (Markdown supported) |
| `featured_image` | `string(uri)` | Hayir | Hayir | maxLength=200 |
| `status` | `Status68aEnum` | Hayir | Hayir |  |
| `published_at` | `string(date-time)` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `updated_at` | `string(date-time)` | Hayir | Evet |  |
| `views` | `integer` | Hayir | Evet |  |
| `tags` | `-` | Hayir | Hayir | List of tag strings |
| `meta_description` | `string` | Hayir | Hayir | SEO meta description; maxLength=160 |
| `category` | `integer` | Hayir | Hayir |  |
| `author` | `integer` | Hayir | Hayir |  |

### `PatchedBusinessPartner`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `email` | `string(email)` | Hayir | Hayir | maxLength=254 |
| `phone` | `string` | Hayir | Hayir | maxLength=50 |
| `address` | `string` | Hayir | Hayir |  |
| `city` | `string` | Hayir | Hayir | maxLength=100 |
| `country` | `string` | Hayir | Hayir | maxLength=50 |
| `currency` | `string` | Hayir | Hayir | maxLength=10 |
| `size` | `string` | Hayir | Hayir | maxLength=50 |
| `tax_office` | `string` | Hayir | Hayir | maxLength=100 |
| `tax_number` | `string` | Hayir | Hayir | maxLength=64 |
| `authorized_person` | `string` | Hayir | Hayir | maxLength=255 |
| `group` | `string` | Hayir | Hayir | maxLength=50 |
| `organization` | `integer` | Hayir | Hayir |  |

### `PatchedCategory`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `name` | `string` | Hayir | Hayir | maxLength=100 |
| `template_defaults` | `-` | Hayir | Hayir |  |
| `attribute_schema` | `-` | Hayir | Hayir |  |

### `PatchedContact`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `role` | `string` | Hayir | Hayir | maxLength=128 |
| `email` | `string(email)` | Hayir | Hayir | maxLength=254 |
| `phone` | `string` | Hayir | Hayir | maxLength=64 |
| `owner` | `string` | Hayir | Hayir | maxLength=128 |
| `organization` | `integer` | Hayir | Hayir |  |
| `company` | `integer` | Hayir | Hayir |  |

### `PatchedContactSubmissionAdmin`
Admin serializer with all fields

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=100 |
| `email` | `string(email)` | Hayir | Hayir | maxLength=254 |
| `company` | `string` | Hayir | Hayir | maxLength=100 |
| `phone` | `string` | Hayir | Hayir | maxLength=20 |
| `message` | `string` | Hayir | Hayir |  |
| `status` | `ContactSubmissionAdminStatusEnum` | Hayir | Hayir |  |
| `ip_address` | `string` | Hayir | Evet |  |
| `user_agent` | `string` | Hayir | Evet |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `updated_at` | `string(date-time)` | Hayir | Evet |  |
| `notes` | `string` | Hayir | Hayir | Internal notes |

### `PatchedInvoice`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `number` | `string` | Hayir | Evet |  |
| `customer_name` | `string` | Hayir | Hayir | maxLength=255 |
| `status` | `InvoiceStatusEnum` | Hayir | Hayir |  |
| `amount` | `string(decimal)` | Hayir | Hayir |  |
| `currency` | `string` | Hayir | Hayir | maxLength=10 |
| `due_date` | `string(date)` | Hayir | Hayir |  |
| `issued_at` | `string(date)` | Hayir | Hayir |  |
| `payments` | `Array<InvoicePayment>` | Hayir | Hayir |  |

### `PatchedLead`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `title` | `string` | Hayir | Hayir | maxLength=120 |
| `status` | `string` | Hayir | Hayir | maxLength=50 |
| `source` | `string` | Hayir | Hayir | maxLength=50 |
| `score` | `integer` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `company` | `integer` | Hayir | Hayir |  |
| `owner` | `integer` | Hayir | Hayir |  |

### `PatchedOpportunity`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `stage` | `string` | Hayir | Hayir | maxLength=50 |
| `value` | `string(decimal)` | Hayir | Hayir |  |
| `close_date` | `string(date)` | Hayir | Hayir |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `lead` | `integer` | Hayir | Hayir |  |
| `company` | `integer` | Hayir | Hayir |  |
| `owner` | `integer` | Hayir | Hayir |  |

### `PatchedPricingRule`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `type` | `PricingRuleTypeEnum` | Hayir | Hayir |  |
| `target` | `string` | Hayir | Hayir | maxLength=255 |
| `value` | `string(decimal)` | Hayir | Hayir |  |
| `description` | `string` | Hayir | Hayir |  |
| `organization` | `integer` | Hayir | Hayir |  |

### `PatchedProduct`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `organization` | `integer` | Hayir | Hayir | default=`1` |
| `sku` | `string` | Hayir | Hayir | default=`` |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `template_defaults` | `-` | Hayir | Hayir |  |
| `attribute_values` | `-` | Hayir | Hayir |  |
| `attribute_schema_override` | `-` | Hayir | Hayir |  |
| `price` | `string(decimal)` | Hayir | Hayir |  |
| `stock` | `string(decimal)` | Hayir | Hayir |  |
| `reserved` | `string(decimal)` | Hayir | Hayir |  |
| `reorder_point` | `string(decimal)` | Hayir | Hayir |  |
| `category` | `integer` | Hayir | Hayir |  |

### `PatchedPurchaseOrder`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `number` | `string` | Hayir | Hayir | maxLength=50 |
| `supplier` | `string` | Hayir | Hayir | maxLength=255 |
| `status` | `PurchaseOrderStatusEnum` | Hayir | Hayir |  |
| `amount` | `string(decimal)` | Hayir | Hayir |  |
| `expected_date` | `string(date)` | Hayir | Hayir |  |
| `organization` | `integer` | Hayir | Hayir |  |

### `PatchedQuote`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `document_type` | `DocumentTypeEnum` | Hayir | Hayir |  |
| `number` | `string` | Hayir | Evet |  |
| `customer` | `integer` | Hayir | Hayir |  |
| `customer_name` | `string` | Hayir | Evet |  |
| `opportunity` | `integer` | Hayir | Hayir |  |
| `owner` | `integer` | Hayir | Hayir |  |
| `owner_name` | `string` | Hayir | Evet |  |
| `prepared_by` | `integer` | Hayir | Evet |  |
| `prepared_by_name` | `string` | Hayir | Evet |  |
| `seller_company_key` | `string` | Hayir | Hayir | maxLength=50 |
| `status` | `QuoteStatusEnum` | Hayir | Hayir |  |
| `valid_until` | `string(date)` | Hayir | Hayir |  |
| `subtotal` | `string(decimal)` | Hayir | Evet |  |
| `discount_total` | `string(decimal)` | Hayir | Evet |  |
| `tax_total` | `string(decimal)` | Hayir | Evet |  |
| `total` | `string(decimal)` | Hayir | Evet |  |
| `currency` | `string` | Hayir | Hayir | maxLength=10 |
| `payment_terms` | `string` | Hayir | Hayir | maxLength=255 |
| `delivery_terms` | `string` | Hayir | Hayir | maxLength=255 |
| `notes` | `string` | Hayir | Hayir |  |
| `vat_rate` | `string(decimal)` | Hayir | Hayir |  |
| `contract_config` | `-` | Hayir | Hayir |  |
| `lines` | `Array<QuoteLine>` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `updated_at` | `string(date-time)` | Hayir | Evet |  |

### `PatchedSalesOrder`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `number` | `string` | Hayir | Hayir | maxLength=50 |
| `customer_name` | `string` | Hayir | Hayir | maxLength=255 |
| `status` | `string` | Hayir | Hayir | maxLength=50 |
| `amount` | `string(decimal)` | Hayir | Hayir |  |
| `shipping_date` | `string(date)` | Hayir | Hayir |  |
| `expected_delivery` | `string(date)` | Hayir | Hayir |  |
| `order_quantity` | `integer` | Hayir | Hayir | Siparis adedi (uretim takibi) |
| `quantity_produced` | `integer` | Hayir | Hayir | Raporlanan tamamlanan adet |
| `organization` | `integer` | Hayir | Hayir |  |

### `PatchedStockMovement`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `movement_type` | `MovementTypeEnum` | Hayir | Hayir |  |
| `quantity` | `string(decimal)` | Hayir | Hayir |  |
| `reference` | `string` | Hayir | Hayir | maxLength=120 |
| `location_from` | `string` | Hayir | Hayir | maxLength=120 |
| `location_to` | `string` | Hayir | Hayir | maxLength=120 |
| `note` | `string` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `product` | `integer` | Hayir | Hayir |  |

### `PatchedTask`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `title` | `string` | Hayir | Hayir | maxLength=255 |
| `owner` | `integer` | Hayir | Hayir |  |
| `assignee` | `integer` | Hayir | Hayir |  |
| `team` | `integer` | Hayir | Hayir |  |
| `mode` | `ModeEnum` | Hayir | Hayir |  |
| `model_code` | `string` | Hayir | Hayir | maxLength=50 |
| `variant` | `string` | Hayir | Hayir | maxLength=50 |
| `quantity` | `integer` | Hayir | Hayir |  |
| `model_duration_minutes` | `string(decimal)` | Hayir | Hayir |  |
| `total_planned_minutes` | `string(decimal)` | Hayir | Hayir |  |
| `model_blade_depth` | `string` | Hayir | Hayir | maxLength=50 |
| `model_sizes` | `-` | Hayir | Hayir |  |
| `product_color` | `string` | Hayir | Hayir | maxLength=100 |
| `product_color_code` | `string` | Hayir | Hayir | maxLength=80 |
| `status` | `TaskStatusEnum` | Hayir | Hayir |  |
| `priority` | `TaskPriorityEnum` | Hayir | Hayir |  |
| `start` | `string(date-time)` | Hayir | Hayir |  |
| `end` | `string(date-time)` | Hayir | Hayir |  |
| `due` | `string(date-time)` | Hayir | Hayir |  |
| `tags` | `-` | Hayir | Hayir |  |
| `planned_hours` | `string(decimal)` | Hayir | Hayir |  |
| `planned_cost` | `string(decimal)` | Hayir | Hayir |  |
| `current_team` | `integer` | Hayir | Hayir |  |
| `handover_reason` | `string` | Hayir | Hayir | maxLength=255 |
| `handover_at` | `string(date-time)` | Hayir | Hayir |  |
| `handover_history` | `-` | Hayir | Hayir |  |
| `workflow_team_ids` | `-` | Hayir | Hayir |  |
| `workflow_parallel` | `boolean` | Hayir | Hayir | True ise bolumler sira beklemeden paralel calisir; usta basi onayi ile kapanir. |
| `workflow_stage_targets` | `-` | Hayir | Hayir | workflow_team_ids ile ayni uzunlukta bolum bazli hedef adetler |
| `workflow_stage_state` | `-` | Hayir | Hayir | Ekip ID -> {assignee_id, qty_target, qty_done, pending_approval, stage_done} |
| `sales_order` | `integer` | Hayir | Hayir |  |
| `product_lines` | `-` | Hayir | Hayir | Her eleman: model_code, variant, quantity, renk, sure vb. - coklu urun kalemleri |
| `active_product_index` | `integer` | Hayir | Hayir | Su an is akisina yansitilan urun satiri (0 tabanli) |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `updated_at` | `string(date-time)` | Hayir | Evet |  |
| `attachments` | `Array<TaskAttachment>` | Hayir | Evet |  |
| `comments` | `Array<TaskComment>` | Hayir | Evet |  |
| `checklist` | `string` | Hayir | Evet |  |
| `time_entries` | `string` | Hayir | Evet |  |
| `production_entries` | `string` | Hayir | Evet |  |

### `PatchedTaskAttachment`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `task` | `integer` | Hayir | Hayir |  |
| `file` | `string(uri)` | Hayir | Hayir |  |
| `file_name` | `string` | Hayir | Evet |  |
| `uploaded_by` | `integer` | Hayir | Evet |  |
| `uploaded_at` | `string(date-time)` | Hayir | Evet |  |
| `description` | `string` | Hayir | Hayir | maxLength=255 |
| `original_name` | `string` | Hayir | Evet |  |
| `content_type` | `string` | Hayir | Evet |  |
| `size` | `integer` | Hayir | Evet |  |
| `version` | `integer` | Hayir | Evet |  |
| `parent` | `integer` | Hayir | Evet |  |
| `tags` | `-` | Hayir | Hayir |  |

### `PatchedTaskChecklist`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `task` | `integer` | Hayir | Hayir |  |
| `title` | `string` | Hayir | Hayir | maxLength=255 |
| `done` | `boolean` | Hayir | Hayir |  |
| `order` | `integer` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `workflow_team` | `integer` | Hayir | Evet | Doluysa madde is akisi bu ekibin adimina baglidir; sira ve tik workflow ile senkron olur. |

### `PatchedTaskComment`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `task` | `integer` | Hayir | Hayir |  |
| `text` | `string` | Hayir | Hayir |  |
| `type` | `TaskCommentTypeEnum` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `author` | `integer` | Hayir | Evet |  |
| `author_name` | `string` | Hayir | Evet |  |

### `PatchedTaskModel`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `code` | `string` | Hayir | Hayir | maxLength=50 |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `image` | `string(uri)` | Hayir | Hayir |  |
| `image_url` | `string` | Hayir | Evet |  |
| `duration_minutes` | `string(decimal)` | Hayir | Hayir |  |
| `blade_min` | `string(decimal)` | Hayir | Hayir |  |
| `blade_max` | `string(decimal)` | Hayir | Hayir |  |
| `width_mm` | `string(decimal)` | Hayir | Hayir |  |
| `height_mm` | `string(decimal)` | Hayir | Hayir |  |
| `thickness_mm` | `string(decimal)` | Hayir | Hayir |  |
| `sizes` | `-` | Hayir | Hayir |  |
| `order` | `integer` | Hayir | Hayir |  |
| `is_active` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `updated_at` | `string(date-time)` | Hayir | Evet |  |

### `PatchedTaskTimeEntry`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `task` | `integer` | Hayir | Hayir |  |
| `user` | `integer` | Hayir | Hayir |  |
| `user_name` | `string` | Hayir | Evet |  |
| `team` | `integer` | Hayir | Hayir |  |
| `section` | `string` | Hayir | Hayir | maxLength=100 |
| `started_at` | `string(date-time)` | Hayir | Hayir |  |
| `ended_at` | `string(date-time)` | Hayir | Hayir |  |
| `note` | `string` | Hayir | Hayir | maxLength=255 |
| `created_at` | `string(date-time)` | Hayir | Evet |  |

### `PatchedTeam`
members: yazarken tamsayi pk listesi (JSON [1,2,3]). Gecersiz veya baska organizasyona ait pk'lar sessizce dusurulur - boylece silinmis kullanici kalintilari yuzunden PATCH 400 olusmaz.

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `organization` | `integer` | Hayir | Evet |  |
| `members` | `Array<integer>` | Hayir | Hayir |  |
| `leader` | `integer` | Hayir | Hayir |  |

### `PatchedTeamAssociate`
Hesapsiz ekip calisani: teams = ekip pk listesi.

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `full_name` | `string` | Hayir | Hayir | maxLength=255 |
| `phone` | `string` | Hayir | Hayir | maxLength=50 |
| `notes` | `string` | Hayir | Hayir | maxLength=500 |
| `teams` | `Array<integer>` | Hayir | Hayir |  |
| `is_active` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `updated_at` | `string(date-time)` | Hayir | Evet |  |

### `PatchedTenantDetail`
Detailed tenant info for admin

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `code` | `string` | Hayir | Hayir | maxLength=50 |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `subscription` | `TenantSubscription` | Hayir | Evet |  |
| `user_count` | `string` | Hayir | Evet |  |

### `PatchedTenantPlan`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=100 |
| `slug` | `string` | Hayir | Hayir | maxLength=50 |
| `plan_type` | `PlanTypeEnum` | Hayir | Hayir |  |
| `description` | `string` | Hayir | Hayir |  |
| `price_monthly` | `string(decimal)` | Hayir | Hayir |  |
| `price_yearly` | `string(decimal)` | Hayir | Hayir |  |
| `max_users` | `integer` | Hayir | Hayir |  |
| `max_storage_gb` | `integer` | Hayir | Hayir |  |
| `features` | `-` | Hayir | Hayir | List of feature codes |
| `is_active` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `updated_at` | `string(date-time)` | Hayir | Evet |  |

### `PatchedTenantSubscription`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `organization_name` | `string` | Hayir | Evet |  |
| `plan_name` | `string` | Hayir | Evet |  |
| `status` | `TenantSubscriptionStatusEnum` | Hayir | Hayir |  |
| `billing_cycle` | `BillingCycleEnum` | Hayir | Hayir |  |
| `trial_ends_at` | `string(date-time)` | Hayir | Hayir |  |
| `current_period_start` | `string(date-time)` | Hayir | Hayir |  |
| `current_period_end` | `string(date-time)` | Hayir | Hayir |  |
| `current_users` | `integer` | Hayir | Hayir |  |
| `current_storage_gb` | `string(decimal)` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `updated_at` | `string(date-time)` | Hayir | Evet |  |
| `notes` | `string` | Hayir | Hayir |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `plan` | `integer` | Hayir | Hayir |  |

### `PatchedTicket`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `subject` | `string` | Hayir | Hayir | maxLength=255 |
| `company_name` | `string` | Hayir | Hayir | maxLength=255 |
| `status` | `TicketStatusEnum` | Hayir | Hayir |  |
| `priority` | `TicketPriorityEnum` | Hayir | Hayir |  |
| `assignee` | `integer` | Hayir | Hayir |  |
| `sla` | `string` | Hayir | Hayir | maxLength=20 |
| `updated_at` | `string(date-time)` | Hayir | Evet |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |
| `messages` | `Array<TicketMessage>` | Hayir | Evet |  |

### `PatchedTicketMessage`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `author` | `integer` | Hayir | Evet |  |
| `message` | `string` | Hayir | Hayir |  |
| `internal` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Hayir | Evet |  |

### `PatchedVehicle`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Hayir | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `plate` | `string` | Hayir | Hayir | maxLength=64 |
| `driver` | `string` | Hayir | Hayir | maxLength=255 |
| `status` | `string` | Hayir | Hayir | maxLength=64 |
| `last_update` | `string(date-time)` | Hayir | Evet |  |
| `location_city` | `string` | Hayir | Hayir | maxLength=128 |
| `location_lat` | `string(decimal)` | Hayir | Hayir |  |
| `location_lng` | `string(decimal)` | Hayir | Hayir |  |
| `distance_today` | `string(decimal)` | Hayir | Hayir |  |
| `avg_speed` | `string(decimal)` | Hayir | Hayir |  |
| `idle_minutes` | `integer` | Hayir | Hayir |  |
| `stops` | `integer` | Hayir | Hayir |  |
| `eta` | `string(date-time)` | Hayir | Hayir |  |
| `temperature` | `string(decimal)` | Hayir | Hayir |  |
| `organization` | `integer` | Hayir | Hayir |  |

### `PlanTypeEnum`
* `starter` - Starter * `professional` - Professional * `enterprise` - Enterprise

Enum degerleri: `starter`, `professional`, `enterprise`

### `PricingRule`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Evet | Hayir | maxLength=255 |
| `type` | `PricingRuleTypeEnum` | Evet | Hayir |  |
| `target` | `string` | Evet | Hayir | maxLength=255 |
| `value` | `string(decimal)` | Evet | Hayir |  |
| `description` | `string` | Hayir | Hayir |  |
| `organization` | `integer` | Evet | Hayir |  |

### `PricingRuleTypeEnum`
* `customer` - Customer * `category` - Category * `volume` - Volume

Enum degerleri: `customer`, `category`, `volume`

### `Product`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `organization` | `integer` | Hayir | Hayir | default=`1` |
| `sku` | `string` | Hayir | Hayir | default=`` |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `template_defaults` | `-` | Hayir | Hayir |  |
| `attribute_values` | `-` | Hayir | Hayir |  |
| `attribute_schema_override` | `-` | Hayir | Hayir |  |
| `price` | `string(decimal)` | Hayir | Hayir |  |
| `stock` | `string(decimal)` | Hayir | Hayir |  |
| `reserved` | `string(decimal)` | Hayir | Hayir |  |
| `reorder_point` | `string(decimal)` | Hayir | Hayir |  |
| `category` | `integer` | Hayir | Hayir |  |

### `PurchaseOrder`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `number` | `string` | Evet | Hayir | maxLength=50 |
| `supplier` | `string` | Evet | Hayir | maxLength=255 |
| `status` | `PurchaseOrderStatusEnum` | Hayir | Hayir |  |
| `amount` | `string(decimal)` | Hayir | Hayir |  |
| `expected_date` | `string(date)` | Hayir | Hayir |  |
| `organization` | `integer` | Evet | Hayir |  |

### `PurchaseOrderStatusEnum`
* `Draft` - Draft * `Ordered` - Ordered * `Receiving` - Receiving * `Closed` - Closed

Enum degerleri: `Draft`, `Ordered`, `Receiving`, `Closed`

### `Quote`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `document_type` | `DocumentTypeEnum` | Hayir | Hayir |  |
| `number` | `string` | Evet | Evet |  |
| `customer` | `integer` | Evet | Hayir |  |
| `customer_name` | `string` | Evet | Evet |  |
| `opportunity` | `integer` | Hayir | Hayir |  |
| `owner` | `integer` | Hayir | Hayir |  |
| `owner_name` | `string` | Evet | Evet |  |
| `prepared_by` | `integer` | Evet | Evet |  |
| `prepared_by_name` | `string` | Evet | Evet |  |
| `seller_company_key` | `string` | Hayir | Hayir | maxLength=50 |
| `status` | `QuoteStatusEnum` | Hayir | Hayir |  |
| `valid_until` | `string(date)` | Hayir | Hayir |  |
| `subtotal` | `string(decimal)` | Evet | Evet |  |
| `discount_total` | `string(decimal)` | Evet | Evet |  |
| `tax_total` | `string(decimal)` | Evet | Evet |  |
| `total` | `string(decimal)` | Evet | Evet |  |
| `currency` | `string` | Hayir | Hayir | maxLength=10 |
| `payment_terms` | `string` | Hayir | Hayir | maxLength=255 |
| `delivery_terms` | `string` | Hayir | Hayir | maxLength=255 |
| `notes` | `string` | Hayir | Hayir |  |
| `vat_rate` | `string(decimal)` | Hayir | Hayir |  |
| `contract_config` | `-` | Hayir | Hayir |  |
| `lines` | `Array<QuoteLine>` | Evet | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |

### `QuoteLine`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `product` | `integer` | Hayir | Hayir |  |
| `product_sku` | `string` | Evet | Evet |  |
| `product_name` | `string` | Evet | Evet |  |
| `section_key` | `string` | Hayir | Hayir | maxLength=64 |
| `name` | `string` | Evet | Hayir | maxLength=255 |
| `unit` | `string` | Hayir | Hayir | maxLength=50 |
| `qty` | `string(decimal)` | Evet | Hayir |  |
| `unit_price` | `string(decimal)` | Evet | Hayir |  |
| `discount` | `string(decimal)` | Hayir | Hayir |  |
| `discount_secondary` | `string(decimal)` | Hayir | Hayir |  |
| `tax` | `string(decimal)` | Hayir | Hayir |  |
| `sort_order` | `integer` | Hayir | Hayir |  |
| `details` | `-` | Hayir | Hayir |  |

### `QuoteStatusEnum`
* `Draft` - Draft * `Sent` - Sent * `Under Review` - Under Review * `Approved` - Approved * `Rejected` - Rejected * `Converted` - Converted

Enum degerleri: `Draft`, `Sent`, `Under Review`, `Approved`, `Rejected`, `Converted`

### `SalesOrder`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `number` | `string` | Evet | Hayir | maxLength=50 |
| `customer_name` | `string` | Evet | Hayir | maxLength=255 |
| `status` | `string` | Hayir | Hayir | maxLength=50 |
| `amount` | `string(decimal)` | Hayir | Hayir |  |
| `shipping_date` | `string(date)` | Hayir | Hayir |  |
| `expected_delivery` | `string(date)` | Hayir | Hayir |  |
| `order_quantity` | `integer` | Hayir | Hayir | Siparis adedi (uretim takibi) |
| `quantity_produced` | `integer` | Hayir | Hayir | Raporlanan tamamlanan adet |
| `organization` | `integer` | Evet | Hayir |  |

### `Status68aEnum`
* `draft` - Draft * `published` - Published

Enum degerleri: `draft`, `published`

### `StockMovement`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `movement_type` | `MovementTypeEnum` | Hayir | Hayir |  |
| `quantity` | `string(decimal)` | Evet | Hayir |  |
| `reference` | `string` | Hayir | Hayir | maxLength=120 |
| `location_from` | `string` | Hayir | Hayir | maxLength=120 |
| `location_to` | `string` | Hayir | Hayir | maxLength=120 |
| `note` | `string` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `product` | `integer` | Hayir | Hayir |  |

### `Task`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `organization` | `integer` | Hayir | Hayir |  |
| `title` | `string` | Evet | Hayir | maxLength=255 |
| `owner` | `integer` | Hayir | Hayir |  |
| `assignee` | `integer` | Hayir | Hayir |  |
| `team` | `integer` | Hayir | Hayir |  |
| `mode` | `ModeEnum` | Hayir | Hayir |  |
| `model_code` | `string` | Hayir | Hayir | maxLength=50 |
| `variant` | `string` | Hayir | Hayir | maxLength=50 |
| `quantity` | `integer` | Hayir | Hayir |  |
| `model_duration_minutes` | `string(decimal)` | Hayir | Hayir |  |
| `total_planned_minutes` | `string(decimal)` | Hayir | Hayir |  |
| `model_blade_depth` | `string` | Hayir | Hayir | maxLength=50 |
| `model_sizes` | `-` | Hayir | Hayir |  |
| `product_color` | `string` | Hayir | Hayir | maxLength=100 |
| `product_color_code` | `string` | Hayir | Hayir | maxLength=80 |
| `status` | `TaskStatusEnum` | Hayir | Hayir |  |
| `priority` | `TaskPriorityEnum` | Hayir | Hayir |  |
| `start` | `string(date-time)` | Hayir | Hayir |  |
| `end` | `string(date-time)` | Hayir | Hayir |  |
| `due` | `string(date-time)` | Hayir | Hayir |  |
| `tags` | `-` | Hayir | Hayir |  |
| `planned_hours` | `string(decimal)` | Hayir | Hayir |  |
| `planned_cost` | `string(decimal)` | Hayir | Hayir |  |
| `current_team` | `integer` | Hayir | Hayir |  |
| `handover_reason` | `string` | Hayir | Hayir | maxLength=255 |
| `handover_at` | `string(date-time)` | Hayir | Hayir |  |
| `handover_history` | `-` | Hayir | Hayir |  |
| `workflow_team_ids` | `-` | Hayir | Hayir |  |
| `workflow_parallel` | `boolean` | Hayir | Hayir | True ise bolumler sira beklemeden paralel calisir; usta basi onayi ile kapanir. |
| `workflow_stage_targets` | `-` | Hayir | Hayir | workflow_team_ids ile ayni uzunlukta bolum bazli hedef adetler |
| `workflow_stage_state` | `-` | Hayir | Hayir | Ekip ID -> {assignee_id, qty_target, qty_done, pending_approval, stage_done} |
| `sales_order` | `integer` | Hayir | Hayir |  |
| `product_lines` | `-` | Hayir | Hayir | Her eleman: model_code, variant, quantity, renk, sure vb. - coklu urun kalemleri |
| `active_product_index` | `integer` | Hayir | Hayir | Su an is akisina yansitilan urun satiri (0 tabanli) |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |
| `attachments` | `Array<TaskAttachment>` | Evet | Evet |  |
| `comments` | `Array<TaskComment>` | Evet | Evet |  |
| `checklist` | `string` | Evet | Evet |  |
| `time_entries` | `string` | Evet | Evet |  |
| `production_entries` | `string` | Evet | Evet |  |

### `TaskAttachment`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `task` | `integer` | Evet | Hayir |  |
| `file` | `string(uri)` | Evet | Hayir |  |
| `file_name` | `string` | Evet | Evet |  |
| `uploaded_by` | `integer` | Evet | Evet |  |
| `uploaded_at` | `string(date-time)` | Evet | Evet |  |
| `description` | `string` | Hayir | Hayir | maxLength=255 |
| `original_name` | `string` | Evet | Evet |  |
| `content_type` | `string` | Evet | Evet |  |
| `size` | `integer` | Evet | Evet |  |
| `version` | `integer` | Evet | Evet |  |
| `parent` | `integer` | Evet | Evet |  |
| `tags` | `-` | Hayir | Hayir |  |

### `TaskChecklist`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `task` | `integer` | Evet | Hayir |  |
| `title` | `string` | Evet | Hayir | maxLength=255 |
| `done` | `boolean` | Hayir | Hayir |  |
| `order` | `integer` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `workflow_team` | `integer` | Evet | Evet | Doluysa madde is akisi bu ekibin adimina baglidir; sira ve tik workflow ile senkron olur. |

### `TaskComment`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `task` | `integer` | Evet | Hayir |  |
| `text` | `string` | Hayir | Hayir |  |
| `type` | `TaskCommentTypeEnum` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `author` | `integer` | Evet | Evet |  |
| `author_name` | `string` | Evet | Evet |  |

### `TaskCommentTypeEnum`
* `comment` - comment * `activity` - activity

Enum degerleri: `comment`, `activity`

### `TaskModel`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `code` | `string` | Evet | Hayir | maxLength=50 |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `image` | `string(uri)` | Hayir | Hayir |  |
| `image_url` | `string` | Evet | Evet |  |
| `duration_minutes` | `string(decimal)` | Hayir | Hayir |  |
| `blade_min` | `string(decimal)` | Hayir | Hayir |  |
| `blade_max` | `string(decimal)` | Hayir | Hayir |  |
| `width_mm` | `string(decimal)` | Hayir | Hayir |  |
| `height_mm` | `string(decimal)` | Hayir | Hayir |  |
| `thickness_mm` | `string(decimal)` | Hayir | Hayir |  |
| `sizes` | `-` | Hayir | Hayir |  |
| `order` | `integer` | Hayir | Hayir |  |
| `is_active` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |

### `TaskPriorityEnum`
* `low` - low * `medium` - medium * `high` - high

Enum degerleri: `low`, `medium`, `high`

### `TaskStatusEnum`
* `todo` - todo * `in-progress` - in-progress * `done` - done

Enum degerleri: `todo`, `in-progress`, `done`

### `TaskTimeEntry`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `task` | `integer` | Evet | Hayir |  |
| `user` | `integer` | Hayir | Hayir |  |
| `user_name` | `string` | Evet | Evet |  |
| `team` | `integer` | Hayir | Hayir |  |
| `section` | `string` | Hayir | Hayir | maxLength=100 |
| `started_at` | `string(date-time)` | Evet | Hayir |  |
| `ended_at` | `string(date-time)` | Hayir | Hayir |  |
| `note` | `string` | Hayir | Hayir | maxLength=255 |
| `created_at` | `string(date-time)` | Evet | Evet |  |

### `Team`
members: yazarken tamsayi pk listesi (JSON [1,2,3]). Gecersiz veya baska organizasyona ait pk'lar sessizce dusurulur - boylece silinmis kullanici kalintilari yuzunden PATCH 400 olusmaz.

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Evet | Hayir | maxLength=255 |
| `organization` | `integer` | Evet | Evet |  |
| `members` | `Array<integer>` | Hayir | Hayir |  |
| `leader` | `integer` | Hayir | Hayir |  |

### `TeamAssociate`
Hesapsiz ekip calisani: teams = ekip pk listesi.

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `full_name` | `string` | Evet | Hayir | maxLength=255 |
| `phone` | `string` | Hayir | Hayir | maxLength=50 |
| `notes` | `string` | Hayir | Hayir | maxLength=500 |
| `teams` | `Array<integer>` | Hayir | Hayir |  |
| `is_active` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |

### `TenantDetail`
Detailed tenant info for admin

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `code` | `string` | Evet | Hayir | maxLength=50 |
| `name` | `string` | Evet | Hayir | maxLength=255 |
| `subscription` | `TenantSubscription` | Evet | Evet |  |
| `user_count` | `string` | Evet | Evet |  |

### `TenantPlan`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Evet | Hayir | maxLength=100 |
| `slug` | `string` | Evet | Hayir | maxLength=50 |
| `plan_type` | `PlanTypeEnum` | Evet | Hayir |  |
| `description` | `string` | Hayir | Hayir |  |
| `price_monthly` | `string(decimal)` | Evet | Hayir |  |
| `price_yearly` | `string(decimal)` | Evet | Hayir |  |
| `max_users` | `integer` | Evet | Hayir |  |
| `max_storage_gb` | `integer` | Evet | Hayir |  |
| `features` | `-` | Hayir | Hayir | List of feature codes |
| `is_active` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |

### `TenantSubscription`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `organization_name` | `string` | Evet | Evet |  |
| `plan_name` | `string` | Evet | Evet |  |
| `status` | `TenantSubscriptionStatusEnum` | Hayir | Hayir |  |
| `billing_cycle` | `BillingCycleEnum` | Hayir | Hayir |  |
| `trial_ends_at` | `string(date-time)` | Hayir | Hayir |  |
| `current_period_start` | `string(date-time)` | Evet | Hayir |  |
| `current_period_end` | `string(date-time)` | Evet | Hayir |  |
| `current_users` | `integer` | Hayir | Hayir |  |
| `current_storage_gb` | `string(decimal)` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `updated_at` | `string(date-time)` | Evet | Evet |  |
| `notes` | `string` | Hayir | Hayir |  |
| `organization` | `integer` | Evet | Hayir |  |
| `plan` | `integer` | Evet | Hayir |  |

### `TenantSubscriptionStatusEnum`
* `trial` - Trial * `active` - Active * `suspended` - Suspended * `cancelled` - Cancelled

Enum degerleri: `trial`, `active`, `suspended`, `cancelled`

### `Ticket`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `subject` | `string` | Evet | Hayir | maxLength=255 |
| `company_name` | `string` | Hayir | Hayir | maxLength=255 |
| `status` | `TicketStatusEnum` | Hayir | Hayir |  |
| `priority` | `TicketPriorityEnum` | Hayir | Hayir |  |
| `assignee` | `integer` | Hayir | Hayir |  |
| `sla` | `string` | Hayir | Hayir | maxLength=20 |
| `updated_at` | `string(date-time)` | Evet | Evet |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |
| `messages` | `Array<TicketMessage>` | Evet | Evet |  |

### `TicketMessage`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `author` | `integer` | Evet | Evet |  |
| `message` | `string` | Evet | Hayir |  |
| `internal` | `boolean` | Hayir | Hayir |  |
| `created_at` | `string(date-time)` | Evet | Evet |  |

### `TicketPriorityEnum`
* `Low` - Low * `Medium` - Medium * `High` - High * `Urgent` - Urgent

Enum degerleri: `Low`, `Medium`, `High`, `Urgent`

### `TicketStatusEnum`
* `Open` - Open * `In Progress` - In Progress * `Waiting` - Waiting * `Resolved` - Resolved * `Closed` - Closed

Enum degerleri: `Open`, `In Progress`, `Waiting`, `Resolved`, `Closed`

### `TokenRefresh`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `access` | `string` | Evet | Evet |  |
| `refresh` | `string` | Evet | Hayir |  |

### `TriggerEnum`
* `task_status_changed` - Task status changed * `task_due_soon` - Task due soon * `task_created` - Task created

Enum degerleri: `task_status_changed`, `task_due_soon`, `task_created`

### `TwoFATokenObtainPair`
Extends JWT login to require otp code if user has otp_enabled. Worker icin mesai saat/gun kontrolu.

| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `username` | `string` | Evet | Hayir |  |
| `password` | `string` | Evet | Hayir |  |

### `Vehicle`
| Alan | Tip | Zorunlu | Readonly | Aciklama / Varsayilan |
|---|---|---:|---:|---|
| `id` | `integer` | Evet | Evet |  |
| `name` | `string` | Hayir | Hayir | maxLength=255 |
| `plate` | `string` | Hayir | Hayir | maxLength=64 |
| `driver` | `string` | Hayir | Hayir | maxLength=255 |
| `status` | `string` | Hayir | Hayir | maxLength=64 |
| `last_update` | `string(date-time)` | Evet | Evet |  |
| `location_city` | `string` | Hayir | Hayir | maxLength=128 |
| `location_lat` | `string(decimal)` | Hayir | Hayir |  |
| `location_lng` | `string(decimal)` | Hayir | Hayir |  |
| `distance_today` | `string(decimal)` | Hayir | Hayir |  |
| `avg_speed` | `string(decimal)` | Hayir | Hayir |  |
| `idle_minutes` | `integer` | Hayir | Hayir |  |
| `stops` | `integer` | Hayir | Hayir |  |
| `eta` | `string(date-time)` | Hayir | Hayir |  |
| `temperature` | `string(decimal)` | Hayir | Hayir |  |
| `organization` | `integer` | Hayir | Hayir |  |

## Mobil Ekip Icin Onerilen Minimum API Kullanim Sirasi

1. Auth: `login`, `refresh`, `me`, `organization-settings`, `permissions/users`.
2. Master data cache: `seller-companies`, `partners`, `contacts`, `products`, `categories`, `teams`, `team-associates`.
3. Ana ekran: `dashboard/kpis`, `tasks`, `quotes`, `tickets`, `approvals/pending`.
4. Belge akisi: `quotes` CRUD, `convert`, `export-pdf`.
5. Gorev akisi: `tasks` CRUD + ozel actionlar, `task-comments`, `task-checklist`, `task-attachments`.
6. Bildirim: foreground icin `stream`, background icin onerilen yeni push-token API.
