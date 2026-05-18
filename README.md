# Udar CRM + ERP Frontend (React + TS + Vite)

Production-grade demo UI with mock data, localStorage persistence, shadcn/ui styling, TanStack Router/Table, Zustand state, RHF + Zod forms, Recharts, and Framer Motion micro-interactions.

## Quickstart
- Lokal Docker stack: `docker compose up --build`
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api`
- Healthcheck: `http://localhost:8000/api/health/`
- Seed demo: `docker compose exec backend python manage.py seed_demo` (ve gerekirse `seed_permissions`)
- Kapatma: `docker compose down`
- Temiz veriyle başlatma: `docker compose down -v`
- Demo login: `admin@demo.com / Admin123!`
- Superadmin login: `superadmin@udarsoft.com / SuperAdmin123!`

## Docker Kurulum Notları
- Geliştirme ortamı ana `docker-compose.yml` dosyasını kullanır. Backend ve frontend kodu container içine mount edilir; değişiklikler canlı geliştirmeye uygundur.
- Docker Desktop'ta containerlar okunur adlarla görünür: `udar-crm-frontend`, `udar-crm-backend`, `udar-crm-postgres`, `udar-crm-redis`, `udar-crm-celery-worker`, `udar-crm-celery-beat`.
- Postgres arayüzü: `http://localhost:8080`
  - Sistem: `PostgreSQL`
  - Sunucu: `db`
  - Kullanıcı: `udar`
  - Şifre: `udar`
  - Veritabanı: `udar_crm`
- Redis arayüzü: `http://localhost:5540`
  - Bağlantı hostu: `redis`
  - Port: `6379`
- Direkt host bağlantıları gerekirse:
  - Postgres: `localhost:5432`
  - Redis: `localhost:6379`
- Firma/production kurulumu `docker-compose.prod.yml` dosyasını kullanır. Örnek ayarlar için `backend/env.prod.example` ve `.env.prod.example` kopyalanıp gerçek domain/secret değerleriyle düzenlenmelidir.
- Production başlatma örneği: `docker compose --env-file .env.prod -f docker-compose.prod.yml up --build -d`
- Production frontend API adresi `PROD_VITE_API_BASE_URL` ile build-time verilir. Örnek: `https://crm.udarsoft.com/api`
- Production nginx konfigürasyonu `deploy/nginx.conf` dosyasındadır ve `/etc/letsencrypt` altında SSL sertifikası bekler.

## Demo basics
- Artık JWT auth + API çağrıları; login ekranı sonrası modüller açılır.
- Role/RBAC UI: kritik aksiyonlar `RbacGuard` ile gizlenir (quotes approve, orders/inventory edit, tickets/tasks edit).
- Global arama (⌘/Ctrl+K), tema/dil ayarı, watermark, demo reset (mock fallback hâlâ hata durumunda çalışır).

## Key screens
- Dashboard: KPI cards, revenue/pipeline charts, cashflow, “Today” panel (tasks, meetings, overdue invoices, low stock).
- CRM: Leads list with filters, saved views, CSV export, create/edit/delete; lead detail timeline; opportunities kanban by stage; companies & contacts directories.
- ERP: Sales orders wizard, purchases list, inventory low-stock workflow + PO CTA, invoicing list with mark-paid modal, accounting ledger mock.
- Support: Ticket queue with SLA/priority, conversation thread and internal notes.
- Reports: Builder UI with dataset/group-by/filter and live chart preview.
- Settings: Org profile, users & roles (UI only), notifications, locale toggle, theme + demo reset.
- Quotes: Teklif listesi/detayı, wizard, onay akışı, fiyat kuralları, satış siparişine dönüşüm (mock).
- Lojistik & Görevler: Araç takibi, görev atama listesi, takvim görünümü.

## Suggested demo flow (slides or live)
1) Start on Dashboard: highlight KPIs, charts, Today panel alerts.  
2) Open command palette (⌘/Ctrl+K) → jump to Leads; show saved views, CSV export; open a lead detail.  
3) Move an opportunity between stages on the kanban.  
4) Go to Inventory, show low-stock workflow → trigger “Create PO”.  
5) Invoicing: mark an invoice as paid via modal; show status update.  
6) Support: open a ticket, add an internal note, mark resolved.  
7) Reports: change dataset/group-by to update preview.  
8) Settings: switch role (e.g., Finance vs. Sales), toggle theme and demo watermark, reset demo data.

### Quote demo flow
1) CRM → Teklifler modülüne geç.  
2) “Yeni teklif” sihirbazında müşteri seç, ürün kalemlerini ekle, ödeme/teslimat şartlarını gir.  
3) Fiyatlama kuralları (müşteri/kategori/hacim) bilgisini göster.  
4) Teklifi “Gönder” ve onay adımlarını (Sales → Manager → Finance) simüle et.  
5) Onayla veya reddet; geçmiş sekmesinde değişiklik kaydını göster.  
6) “Satış siparişi”ne dönüştür ve ERP Sales Orders ekranına yönlendir (mock).

## Backend (Django/DRF) kısa notlar
- Hizmetler: Postgres, Redis, Django API (`backend/`), Celery worker/beat.
- JWT: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me`
- CRM/ERP: `/api/quotes`, `/api/pricing-rules`, `/api/partners`, `/api/products`, `/api/leads`, `/api/opportunities`
- Aksiyonlar: `/api/quotes/{id}/send|convert|request_approval|approve|reject`
- Workflow: `/api/approvals/` (instance + steps), `/api/approvals/pending/`
- Audit: `/api/audit/?entity=Quote&entity_id=...` (audit.view izni)
- Inventory: `/api/stock-movements/`, `/api/purchase-orders/`, `/api/sales-orders/`
- Destek: `/api/tickets/`, `/api/ticket-messages/`, `/api/tasks/`
- OpenAPI: `/api/schema/`, Swagger UI: `/api/docs/`
