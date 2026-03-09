You are continuing an EXISTING, already working product:
- A production-ready CRM/ERP app (Udar CRM) with backend (Django/DRF + Postgres + Redis/Celery) and frontend (React/TS).
- Authentication, RBAC, multi-tenancy/organizations, modules, quotes/approvals, etc. already work.

DO NOT rewrite the core CRM/ERP system.
Your task is to ADD a complete “Product Website + Customer Portal + Admin Console” layer on top of the existing system.

PRIMARY GOALS
A) Public marketing website (landing + pages) that explains Udar CRM, shows how it works, and has a contact form.
B) Customer portal experience: customers can log in from the public site and be routed into their tenant workspace (the existing CRM app).
C) A separate Admin Console for me (platform owner / superadmin) to manage customers/tenants, users, plans, and blog content.
D) Blog feature: public blog list + blog detail pages, and admin CRUD to create/edit/publish/unpublish posts.

NON-NEGOTIABLE CONSTRAINTS
- Keep existing CRM routes, data model, and UI intact.
- Only add new routes/apps and integrate authentication flows cleanly.
- Must be secure: prevent tenant data leaks, proper permission checks, rate limiting, audit logs.
- Must be production-grade and coherent (same design system, consistent navigation).

SUBDOMAIN ARCHITECTURE (IMPORTANT)

Implement the system using the following domain structure:

- Public Marketing Website:
  https://udarsoft.com

- Customer CRM Application (existing system):
  https://crm.udarsoft.com

- Platform Owner Admin Console:
  https://admin.udarsoft.com

Users must be able to log in from:
https://udarsoft.com/login

After login:

- If user is a superadmin → redirect to https://admin.udarsoft.com
- If user is a customer/tenant user → redirect to https://crm.udarsoft.com

Authentication must work across all subdomains using secure cookies:

Cookie Domain: .udarsoft.com

Ensure:

- Single login works across:
  udarsoft.com
  crm.udarsoft.com
  admin.udarsoft.com

- Existing CRM remains untouched at crm.udarsoft.com

ARCHITECTURE DECISION
Implement a unified product experience using:

1) Public Site (unauthenticated)
   Hosted at:
   https://udarsoft.com

2) Customer App (authenticated tenant workspace)
   Hosted at:
   https://crm.udarsoft.com

3) Owner Admin Console (superadmin only)
   Hosted at:
   https://admin.udarsoft.com

FRONTEND REQUIREMENTS (React)
- Add a Public Site layout with modern marketing design.
- Add a Portal Login screen from the public site.
- Implement Auth Gateway:
  - After login detect role:
    - If superadmin → redirect to admin.udarsoft.com
    - Else → redirect to crm.udarsoft.com

Use existing design system (Tailwind + shadcn/ui).

PUBLIC MARKETING SITE CONTENT (Udar CRM)

Create:

1) Home
- Hero: Udar CRM — Secure, Modern CRM + ERP for Growing Businesses
- CTA: Request a Demo
- CTA: Login

2) How It Works
- Lead → Opportunity → Quote → Approval → Sales Order → Invoice

3) Features
- CRM
- Operations
- Finance
- Support
- Governance

4) Security
- Tenant isolation
- RBAC
- Audit logs

5) Pricing

6) Blog

7) Contact
- Store submissions in backend

8) Login
- Redirect based on role

CUSTOMER PORTAL
- Customers login via udarsoft.com
- After login open crm.udarsoft.com
- Load their tenant workspace

OWNER ADMIN CONSOLE (admin.udarsoft.com)

Superadmin-only panel:

Admin Dashboard
Tenants Management
Tenant Detail
Admin Users
Blog Admin
Contact Leads

BACKEND REQUIREMENTS (Django/DRF)

Add models:

- BlogPost
- ContactSubmission
- TenantPlan
- TenantSubscription

Permissions:

Public:
GET /api/v1/blog
GET /api/v1/blog/:slug
POST /api/v1/contact

Superadmin:
CRUD /api/v1/admin/tenants
CRUD /api/v1/admin/blog
CRUD /api/v1/admin/contact-submissions

Auth integration:

Use existing JWT auth.

Add:
POST /api/v1/auth/login
GET /api/v1/auth/me

Must return:
- is_superadmin
- tenant memberships

Security:
- Rate limit contact form
- Sanitize blog content
- Audit log admin actions

FRONTEND INTEGRATION

Public Header:
Product
Features
Security
Pricing
Blog
Contact
Login

Admin Sidebar:
Dashboard
Tenants
Users
Blog
Contact Leads

VISUAL QUALITY
Premium SaaS design.

DELIVERABLES
- Do not break crm.udarsoft.com
- Add only necessary layers
- Seed:
  - 1 superadmin
  - 1 tenant
  - 5 blog posts