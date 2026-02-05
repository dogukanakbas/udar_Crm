# Mobil Uygulama API Kılavuzu

Bu döküman, mobil uygulamanın hangi ekranında hangi endpoint'in kullanılacağını, hangi alanların döneceğini ve gerekli parametreleri özetler.

## Kimlik Doğrulama
- **Giriş**: `POST /api/auth/login/` → `{ access, refresh }`
  - Body: `username`, `password`
- **Token yenileme**: `POST /api/auth/refresh/` → `{ access }`
  - Body: `refresh`
- **Me**: `GET /api/auth/me/` → `{ id, username, email, role, notification_prefs }`
  - Header: `Authorization: Bearer <access>`

## Görevler (Tasks)
- **Liste (board/list)**: `GET /api/tasks/`
  - Dönen başlıca alanlar: `id, title, status, priority, assignee, team, start, end, due, planned_hours, planned_cost, tags`
  - Parametreler: `status`, `assignee`, `team`, `priority`, `search`, `page`, `page_size`
- **Detay**: `GET /api/tasks/{id}/`
  - İçerik: tüm görev alanları + `attachments, comments, checklist, time_entries, history`
- **Oluştur / Güncelle**:
  - `POST /api/tasks/`
  - `PATCH /api/tasks/{id}/`
  - Alanlar: `title, owner, assignee, team, status, priority, start, end, due, notes, planned_hours, planned_cost, tags`
- **Checklist**:
  - `POST /api/task-checklist/` → `{ id, task, title, done }`
  - `PATCH /api/task-checklist/{id}/` (done toggle)
- **Yorum**:
  - `POST /api/task-comments/` → `{ id, task, text, author, created_at, type }`
- **Ekler**:
  - `POST /api/task-attachments/` (multipart) → `{ id, file, description, content_type, size, uploaded_at, tags, version }`
  - `DELETE /api/task-attachments/{id}/`
  - `PATCH /api/task-attachments/{id}/` (description/rename, tags)
- **Zaman takibi**:
  - `POST /api/task-time-entries/` → `{ id, task, started_at, ended_at, note, duration }`
- **SLA / Yaklaşan görevler**:
  - Liste üzerinden `due`/`end` ile mobilde hesaplanabilir; ayrıca:
  - `GET /api/tasks/?due__lte=<iso_date>` (24s filtresi vb.)

## Takvim / Toplantı
- **Görev takvimi**: `GET /api/tasks/?status!=done&start__lte=<end>&end__gte=<start>`
- **Toplantı listesi**: `GET /api/tasks/?tags=meeting` (ayrı model yoksa etiketle çözüm)
- **ICS export**: `GET /api/calendar/ics/`

## Kanban / İş Yükü
- **Kanban board**: `GET /api/tasks/` (status, assignee/team filtreleri)
- **İş yükü**: `GET /api/tasks/?assignee=<user>` veya tümünü çekip mobilde grupla

## Bildirim / Timeline
- **SLA yaklaşan/geciken**: `GET /api/tasks/?status!=done&due__lte=<iso_date>` veya mobilde due hesaplama
- **SSE (opsiyonel)**: `GET /api/stream/?token=<access>` (mobilde genellikle periyodik poll önerilir)
  - Poll alternatifi: `GET /api/tasks/?updated_after=<ts>`, `GET /api/task-comments/?created_after=<ts>`
- **Timeline (görev detayı)**: `GET /api/tasks/{id}/` içindeki `comments`, `attachments`, `history`

## CRM (Lead/Şirket/Kişi/Fırsat/Teklif)
- **Leads**: `GET /api/leads/`, `POST /api/leads/`
- **Şirketler (BusinessPartner)**: `GET /api/partners/`, `POST /api/partners/`
- **Kişiler (Contacts)**: `GET /api/contacts/`, `POST /api/contacts/`
- **Fırsatlar (Opportunities)**: `GET /api/opportunities/`, `POST /api/opportunities/`
- **Teklifler (Quotes)**:
  - `GET /api/quotes/`, `GET /api/quotes/{id}/`
  - `POST /api/quotes/`
  - Aksiyonlar: `POST /api/quotes/{id}/send/`, `/request_approval/`, `/approve/`, `/reject/`, `/convert/`

## ERP
- **Ürünler (Inventory)**: `GET /api/products/`, `POST /api/products/`
- **Satış Siparişleri**: `GET /api/sales-orders/`, `POST /api/sales-orders/`
- **Araçlar (Lojistik)**: `GET /api/vehicles/`, `POST /api/vehicles/`
- **Stok hareketleri**: `POST /api/stock-movements/`

## Destek / Ticket
- **Ticket listesi**: `GET /api/tickets/`
- **Ticket mesajı**: `POST /api/ticket-messages/`

## Ayarlar / Kullanıcı
- **Kullanıcı listesi**: `GET /api/auth/users/`
- **Kullanıcı oluştur (admin)**: `POST /api/auth/create-user/`
- **Takım listesi**: `GET /api/teams/`, `POST /api/teams/`
- **Bildirim tercihleri**: `POST /api/auth/notification-prefs/`

## Raporlar / KPI
- **Dashboard KPI**: `GET /api/dashboard/kpis/`
- **Onay bekleyenler**: `GET /api/approvals/pending/`

## Sağlık / Sistem
- **Health check**: `GET /health/`

## Önerilen mobil veri akışı
- Auth → Token sakla → `/api/auth/me/` ile rol/izin al.
- Liste ekranları: `/api/tasks/` (filtre parametreleriyle), gerekirse pagination.
- Detay ekranı: `/api/tasks/{id}/` tek istekle (yorum, ek, checklist, zaman takibi, tarih).
- Bildirim/SLA: liste verisinden due hesapla veya `due__lte` filtreli GET.
- Arama: `GET /api/search/?q=<term>` (varsa global search), yoksa ilgili modülleri filtre parametreleriyle sorgula.



