# Udar CRM + ERP Frontend (React + TS + Vite)

Production-grade demo UI with mock data, localStorage persistence, shadcn/ui styling, TanStack Router/Table, Zustand state, RHF + Zod forms, Recharts, and Framer Motion micro-interactions.

## Quickstart
- Install: `npm install`
- Run dev server: `npm run dev`
- Build: `npm run build` then `npm run preview`
- Full stack: `docker-compose up -d db redis backend celery_worker celery_beat frontend`
- Seed demo (backend container): `python manage.py seed_demo` (ve `seed_permissions`)
- Login: `admin / password` — `VITE_API_BASE_URL=http://localhost:8000/api`

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
