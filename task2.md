You are continuing an existing CRM–ERP frontend project that is already implemented 
(dashboard, CRM, ERP, inventory, invoices, tickets, reports, settings, etc.).

DO NOT rewrite the whole project.
Extend the current codebase by ADDING a complete Quote (Offer / Teklif) Management flow 
that integrates into the existing CRM and ERP structure.

GOAL
- Add professional, enterprise-level Quote module.
- Integrate it into existing navigation, dashboard, global search, roles, and workflows.
- No backend. Use the project’s current mock DB / localStorage pattern.

NEW MODULE: QUOTE MANAGEMENT

ROUTES
- /crm/quotes
- /crm/quotes/new
- /crm/quotes/:id

1) Quote List Page
- Table with:
  - Quote No
  - Customer (Business Partner)
  - Owner
  - Total Amount
  - Status (Draft, Sent, Under Review, Approved, Rejected, Converted)
  - Valid Until
- Filters:
  - Status
  - Customer
  - Amount range
  - Date range
- Bulk actions: delete, export CSV (frontend only)
- Saved views support (if table already supports it)

2) Create/Edit Quote (Wizard Style)
Step 1: Select Customer  
- Pick from existing Business Partners / Customers  
- Show customer summary card  

Step 2: Products & Services  
- Product picker modal  
- Add line items: product, quantity, unit price, discount, tax  
- Live calculation: subtotal, discount total, tax, grand total  

Step 3: Pricing Rules  
- Apply:
  - Customer-based discount  
  - Product-category discount  
  - Order-total discount  
- Rules should be visible and explainable in UI  

Step 4: Terms  
- Validity date  
- Payment terms  
- Delivery terms  
- Notes  

Step 5: Review  
- Summary screen before save  
- Save as Draft or Send for Approval  

3) Quote Detail Page
Header:
- Quote number, customer, total, status

Tabs:
- Overview
- Line Items
- Pricing Breakdown
- Approval Flow
- History & Notes

Actions:
- Edit (if draft)
- Send Quote (mock email modal)
- Request Approval
- Approve / Reject (role-based)
- Convert to Sales Order
- Duplicate Quote

4) Approval Flow (SAP-style)
- Visual stepper:
  - Sales → Manager → Finance
- Status per step: Waiting, Approved, Rejected
- Comment box per approval step
- Approval Center integration:
  - Add “Quote approvals” to existing Approvals screen

5) Pricing Rule Engine (Frontend Only)
- New screen or modal to manage pricing rules:
  - Customer group discount
  - Product category discount
  - Volume discount
- Quote recalculates totals live when rules change

6) CRM Integration
- From Opportunity detail:
  - “Create Quote” button
- Link quote to:
  - Lead
  - Opportunity
  - Business Partner

7) ERP Integration
- “Convert to Sales Order”:
  - Creates a new Sales Order using quote data
  - Redirects to existing Sales Order detail page

8) Audit & History
- Every quote change logged:
  - Field, old value, new value, user, time
- Timeline UI in quote detail

9) Demo Utilities
- “Auto-fill sample quote” button
- Reset demo data keeps quotes too
- Demo mode watermark respected

UI & STYLE
- Follow existing design system exactly
- Use same layout, tables, forms, animations
- SAP/Fiori-like: List Report + Object Page style
- Breadcrumbs and page headers consistent

DELIVERABLE
- Only modify and add necessary files
- Do not break existing features
- Add mock data:
  - 15 sample quotes in different states
- Update README:
  - Add “Quote demo flow” section:
    1) Create opportunity
    2) Create quote
    3) Apply pricing rules
    4) Send for approval
    5) Approve
    6) Convert to sales order

IMPORTANT
- This is an extension, not a rewrite.
- Reuse existing patterns, stores, components.
- Keep everything frontend-only.
- Focus on making Quote module visually impressive and smooth for presentation.
