You are a senior full-stack architect. We already have a complete CRM–ERP frontend (React + TS + Tailwind + shadcn) built as a local demo with mockDb/localStorage. 
Now convert this into a REAL working system by designing and implementing a production backend and connecting the existing frontend to it.

IMPORTANT
- Do NOT rewrite the UI. Keep screens/components and UX.
- Replace mockDb/localStorage with real API calls.
- Keep existing frontend routing/components; only refactor data layer (services/hooks/stores).
- Deliver a working monorepo (or two repos) that runs locally with docker-compose.
- Provide a clean architecture: authentication, RBAC, multi-tenant org structure, audit logs, approvals, pricing rules, integrations, background jobs.

TARGET STACK (Backend)
- Python Django + Django REST Framework
- PostgreSQL
- Redis (cache + Celery broker)
- Celery for background jobs (emails, reminders, scheduled tasks, report generation)
- OpenAPI/Swagger documentation
- Docker + docker-compose for local dev
- Optional: MinIO (S3 compatible) for attachments

FRONTEND
- Existing React app
- Add an API client layer (axios/fetch) + typed SDK generated from OpenAPI if possible
- Add token handling, refresh, and route guards
- Maintain existing state management (Zustand) but load/commit through API

HIGH-LEVEL BUSINESS REQUIREMENTS
We have CRM + ERP modules: Dashboard, Leads, Opportunities, Quotes, Sales Orders, Purchases, Inventory, Invoices, Accounting-lite, Tickets, Reports, Settings, Approvals, Audit Log, Integrations.
We also added Quote flow: Draft → Sent → Under Review → Approved/Rejected → Converted.

CORE ARCHITECTURE REQUIREMENTS

1) Multi-Tenancy / Organization Model (SAP-like)
- Support multiple organizations (tenants). Each user belongs to an org.
- Org structure: Company, Branch, Warehouse, Sales Org (minimal but extensible).
- Data isolation: user can only access their org’s data.
- Provide org-scoped number ranges: quote numbers, invoice numbers, order numbers.

2) AuthN & AuthZ
- JWT access + refresh token auth.
- Role-based access control (RBAC): Admin, Manager, Sales, Finance, Support, Warehouse.
- Fine-grained permissions: module actions (read/write/approve/export).
- Optional row-level restrictions: e.g., Sales sees only own leads/opps unless manager.

3) Audit Logging (enterprise)
- Log changes for critical objects (quote/order/invoice/product/bp):
  - who, when, field, old value, new value, action type.
- Expose API + UI hooks already exist (timeline). Ensure consistent feed.

4) Workflow / Approvals (SAP-style)
- Approval instances for quotes (and later orders/purchases).
- Stepper model: Sales → Manager → Finance.
- State machine enforced server-side.
- Comments per step, rejection reason, re-submit behavior.
- Approvals inbox endpoint: “my pending approvals”.

5) Pricing Rules Engine (server-side)
- Store pricing rules (customer group discount, product category discount, order total thresholds).
- Quote calculations must be canonical from backend:
  - backend recalculates totals on create/update; frontend only previews.
- Support tax rules (simple) and currency formatting.

6) Performance & UX
- Pagination, filtering, sorting for all lists (TanStack Table compatible).
- Search endpoints for global search (Cmd+K):
  - quick search across bp/leads/opps/quotes/invoices/products/tickets.
- Caching for heavy endpoints (dashboard KPIs).
- Use DB indexes for common filters.

7) Attachments & Notes
- Allow uploading attachments for quotes/tickets (MinIO optional).
- Notes/comments timeline objects.

8) Integrations Scaffold (no real external calls needed initially)
- Create an “Integration” model: email, e-invoice, cargo, accounting.
- Provide status, last sync, logs table.
- Later these can be implemented via Celery tasks.

9) Operational Needs
- Health check endpoint
- Structured logging
- Environment configs
- Seed data script for demo org + users (Admin/Sales/Finance)
- Migrations and tests for critical flows (quotes approvals)

DOMAIN MODEL (Define Entities & Relationships)
Implement these Django models with proper relations and constraints:
- Organization, Branch, Warehouse
- User, Role, Permission mapping
- BusinessPartner (customer/vendor/contact unified) + contact persons
- Lead, Opportunity
- Product, Category, InventoryLocation, StockMovement
- Quote, QuoteLineItem
- PricingRule
- ApprovalFlowTemplate (optional), ApprovalInstance, ApprovalStep
- SalesOrder, SalesOrderLine
- Invoice, InvoicePayment
- Ticket, TicketMessage
- AuditLog
- Integration, IntegrationLog
- NumberRange (per org, per doc type)

API DESIGN (REST)
Create a versioned API: /api/v1/...
For each module implement endpoints:
- CRUD for list/detail
- List endpoints support:
  - page, page_size
  - sort, order
  - filters by query params
- Dedicated endpoints:
  - POST /auth/login, /auth/refresh, /auth/logout
  - GET /me
  - GET /search?q=...
  - GET /dashboard/kpis
  - POST /quotes/{id}/send
  - POST /quotes/{id}/request-approval
  - POST /approvals/{id}/approve
  - POST /approvals/{id}/reject
  - POST /quotes/{id}/convert-to-order
  - POST /pricing-rules/apply-preview (optional)
- OpenAPI docs must describe all endpoints and schemas.

BUSINESS LOGIC RULES (MUST ENFORCE SERVER-SIDE)
- Quote totals always computed on backend.
- Only allowed status transitions.
- Approval required for discount > X or total > Y (configurable per org).
- Finance can approve invoices and mark paid; Sales cannot.
- Concurrency: use updated_at versioning and reject stale updates (optimistic locking).
- Number ranges must be atomic (transaction).

BACKGROUND JOBS (CELERY)
- Send quote email (mock - logs only)
- Invoice reminders for overdue
- Nightly KPI recompute cache
- Integration sync stubs (logs only)

FRONTEND INTEGRATION PLAN (Step-by-step)
1) Add env config: VITE_API_BASE_URL
2) Create api client: axios instance with interceptors:
   - attach access token
   - on 401 try refresh token, retry once
3) Replace mockDb calls with API in a dedicated data layer:
   - /src/api/*.ts (typed services)
   - /src/hooks/useLeads, useQuotes etc.
4) Update Zustand stores:
   - load from API on page load
   - optimistic UI on create/update (optional)
   - handle error toasts and rollback
5) Implement route guards:
   - if not logged in redirect to /login
   - role-based route gating consistent with backend permissions
6) Pagination/filter mapping:
   - TanStack Table state → API query params
7) Ensure existing UI features still work:
   - saved views stored in frontend localStorage (ok)
   - export CSV uses backend list endpoint or frontend export (acceptable)
8) Replace demo role switcher with real login screen + demo seeded users.

DELIVERABLES
- docker-compose.yml with services: backend, postgres, redis (and minio optional), frontend
- Backend code with migrations and seed command:
  - python manage.py seed_demo
- README with:
  - how to run
  - demo credentials:
    - admin@demo.com / Admin123!
    - sales@demo.com / Sales123!
    - finance@demo.com / Finance123!
  - key API endpoints
  - how approvals work
- Tests:
  - quote totals calculation
  - approval transitions
  - convert quote to order
- Ensure everything runs:
  - docker-compose up
  - frontend connects to backend and all core flows work end-to-end

QUALITY BAR
- Clean code, modular apps (crm, erp, core, auth, workflow, audit)
- Serializer validation, permissions, transactions, indexes
- Meaningful error messages for frontend
- No breaking existing UI; only refactor data fetching layer
