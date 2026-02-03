You are a senior product engineer + UI designer. Build a production-grade, presentation-ready CRM + ERP Frontend (NO BACKEND). Deliver a complete, polished UI with realistic mock data and interactions. Use React + TypeScript + Vite + TailwindCSS. Use shadcn/ui components and lucide-react icons. Use TanStack Router (or React Router) for navigation and TanStack Table for grids. Use React Hook Form + Zod for forms/validation. Use Zustand for local state. Use Recharts for charts. Use Framer Motion for subtle animations. 

GOAL
- Only frontend (no server calls). Use in-memory mock DB + localStorage persistence.
- Extremely clean, modern enterprise look (Stripe/Linear-ish), consistent spacing, typography, iconography, empty/loading/error states.
- Everything should be demoable in a presentation: fast, smooth, realistic flows, responsive, accessible.

PROJECT OUTPUT
- Provide full source code files and folder structure.
- Must run with: npm install && npm run dev
- Provide a seed mock dataset and a “Reset Demo Data” button in Settings.
- Provide a short README with run steps + demo credentials (if any) + key screens list.

DESIGN SYSTEM
- Theme: light + dark mode toggle, system preference support.
- Layout: AppShell with collapsible left sidebar, topbar with global search, notifications, help, user menu.
- Use a 12-column grid approach. Max content width on large screens. Responsive.
- Components: Buttons, Inputs, Selects, DatePicker, Tabs, Dialog, Drawer, Dropdown, Breadcrumbs, Toasts, Skeleton loaders.
- Tables: sticky header, column resize, sort, filter, pagination, row selection, bulk actions, export CSV (frontend only), saved views.
- Forms: multi-step forms, inline validation, error summary, autosave draft (localStorage), unsaved changes prompt.
- Accessibility: keyboard nav, aria labels, focus states.

ROUTES / MODULES (CRM + ERP)
1) /dashboard
   - KPI cards (Revenue, Pipeline, AR, Inventory value, Tickets, On-time delivery)
   - Charts: revenue trend, pipeline by stage, top products, cashflow (mock)
   - “Today” panel: tasks, meetings, overdue invoices, low stock alerts
2) /crm/leads
   - Lead list (table) with filters (source, owner, status, score) + saved views
   - Lead detail page: timeline (notes/calls/emails), activities, attachments, related company
   - Actions: convert to opportunity, assign owner, add note, schedule task
3) /crm/opportunities
   - Kanban pipeline board by stage with drag-drop
   - Opportunity detail: value, stage history, stakeholders, products/quotes
   - Quote builder UI: line items, discounts, tax, PDF preview mock
4) /crm/companies & /crm/contacts
   - Company directory + contact person list
   - Company detail: overview, deals, invoices, tickets
5) /erp/sales-orders
   - Sales order list + create order (wizard)
   - Order detail: status timeline, shipping, invoice link, pick/pack UI mock
6) /erp/purchases
   - Purchase orders list + supplier detail
7) /erp/inventory
   - Products table: SKU, category, stock, reserved, reorder point
   - Warehouse view: locations, stock movements timeline
   - “Low Stock” workflow + create purchase order action (UI only)
8) /erp/invoicing
   - Invoices list: statuses (draft/sent/paid/overdue)
   - Invoice detail: payment history mock, send invoice modal, mark as paid
9) /erp/accounting (lightweight)
   - AR/AP overview cards, cashflow chart mock, ledger table mock
10) /support/tickets
   - Ticket list + SLA badges, priority, assignee
   - Ticket detail: conversation thread UI, internal notes, status changes
11) /reports
   - Report builder UI: choose dataset, filters, group by, chart/table output, save report
12) /settings
   - Organization profile, users & roles (RBAC UI), notification prefs, theme
   - Integrations page (placeholders), API keys UI (mock), audit log UI

CROSS-CUTTING FEATURES
- Global search (Cmd/Ctrl+K) opens command palette:
  - Search leads, companies, invoices, products, tickets
  - Quick actions: “Create lead”, “Create invoice”, “New ticket”
- Notification center (mock) + toasts for actions.
- Permission/Roles UI (Admin/Manager/Sales/Finance/Support/Warehouse) – purely frontend gating of menu items and buttons.
- Breadcrumbs everywhere + consistent page headers with primary/secondary actions.
- Empty states with clear call-to-action, skeleton loading, and error boundary pages.
- Print-friendly invoice/quote view.
- Multi-currency formatting + Turkish locale option toggle (but keep UI language English unless asked).
- Include realistic fake data: ~50 leads, 30 companies, 100 products, 40 invoices, 25 tickets, etc.

TECHNICAL REQUIREMENTS
- Use TypeScript strict mode.
- Clean code: components organized by domain, reusable UI primitives, hooks, utils.
- State:
  - mockDb.ts with CRUD functions (sync, in-memory)
  - persistence layer: localStorage with versioning and migration stub
- Routing: nested routes with layout and lazy loading.
- Error handling: error boundaries per route + global fallback page.
- Performance: virtualization for large tables (optional but preferred).
- Do NOT include any backend API, authentication server, or database. Any “login” should be a purely local demo screen that selects a role and stores it in localStorage.
- Add a “Demo Mode” watermark toggle for screenshots.

DELIVERABLE CHECKLIST (must satisfy)
- Professional UI with no missing screens/links
- All routes implemented + navigation works
- All lists have create/edit/delete modals or pages (frontend only)
- All detail pages show realistic sections and interactions
- Polished micro-interactions (loading, toasts, confirmation dialogs)
- Responsive and accessible

Start by generating the complete project structure and code. Then provide a brief README with run steps and demo flow suggestions for presenting the product in a slideshow.
