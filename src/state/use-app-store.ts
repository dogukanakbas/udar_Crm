import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import api from '@/lib/api'
import { clearTokens, getTokens } from '@/lib/auth'
import { normalizeCompanySize, normalizeCountryLabel, resolveCompanyCurrency } from '@/lib/location-data'
import { buildTemplateCatalogImportPayload } from '@/lib/template-product-catalog'
import type {
  Category,
  Invoice,
  Lead,
  MockDbSnapshot,
  Opportunity,
  Product,
  Company,
  Contact,
  Vehicle,
  Team,
  UserLite,
  Role,
  Ticket,
  Task,
  Quote,
  PricingRule,
  SalesOrder,
} from '@/types'
import { startSse as startSseClient } from '@/lib/sse'
import { mapApiProductLineToTask, taskProductLinesToApiPayload } from '@/lib/task-product-lines-helpers'

type AppState = {
  data: MockDbSnapshot
  resetDemo: () => void
  hydrateFromApi: () => Promise<void>
  startSse: () => void | (() => void)
  setRole: (role: Role) => void
  logAccess?: (action: string, meta?: Record<string, any>) => void
  setLocale: (locale: MockDbSnapshot['settings']['locale']) => void
  createCompany: (payload: Omit<Company, 'id'>) => Promise<Company | undefined>
  updateCompany: (id: string, patch: Partial<Company>) => void
  createContact: (payload: Omit<Contact, 'id'>) => void
  createLead: (payload: Omit<Lead, 'id' | 'createdAt' | 'timeline'>) => void
  updateLead: (id: string, patch: Partial<Lead>) => void
  deleteLead: (id: string) => void
  createOpportunity: (payload: Omit<Opportunity, 'id' | 'history' | 'products'>) => void
  updateOpportunity: (id: string, patch: Partial<Opportunity>) => void
  updateOpportunityStage: (id: string, stage: Opportunity['stage']) => void
  addTicketMessage: (id: string, message: Ticket['thread'][number]) => void
  updateTicket: (id: string, patch: Partial<Ticket>) => void
  markInvoiceStatus: (id: string, status: Invoice['status']) => void
  addInvoicePayment: (id: string, payment: Invoice['payments'][number]) => void
  adjustInventory: (sku: string, delta: number) => void
  upsertProduct: (product: Partial<Product> & { sku: string }) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  upsertCategory: (category: Partial<Category>) => Promise<void>
  bulkUpsertProducts: (payload: {
    categories: Array<Record<string, any>>
    products: Array<Record<string, any>>
  }) => Promise<{
    created_categories: number
    updated_categories: number
    created_products: number
    updated_products: number
    total_categories: number
    total_products: number
  }>
  syncTemplateCatalogToInventory: () => Promise<{
    created_categories: number
    updated_categories: number
    created_products: number
    updated_products: number
    total_categories: number
    total_products: number
  }>
  createVehicle: (payload: Omit<Vehicle, 'id' | 'last_update'>) => void
  createSalesOrder: (payload: Partial<SalesOrder>) => void
  createTask: (task: Omit<Task, 'id'>) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  moveTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  addTaskComment: (payload: { task: string; text: string; type?: 'comment' | 'activity' }) => void
  addChecklistItem: (payload: { task: string; title: string }) => void
  toggleChecklistItem: (id: string, done: boolean) => void
  deleteChecklistItem: (id: string) => void
  reorderChecklistItems: (taskId: string, orderedIds: string[]) => void
  deleteAttachment: (id: string) => void
  updateAttachment: (id: string, patch: { description?: string; tags?: string[] }) => void
  addTimeEntry: (payload: { task: string; started_at: string; ended_at?: string; note?: string }) => void
  createQuote: (payload: Omit<Quote, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateQuote: (id: string, patch: Partial<Quote>) => Promise<void>
  sendQuote: (id: string) => Promise<void>
  requestQuoteApproval: (id: string) => Promise<void>
  deleteQuotes: (ids: string[]) => Promise<void>
  convertQuote: (id: string) => Promise<Quote | undefined>
  upsertPricingRule: (rule: PricingRule) => void
  deletePricingRule: (id: string) => void
}

const emptySnapshot: MockDbSnapshot = {
  version: 1,
  leads: [],
  opportunities: [],
  companies: [],
  contacts: [],
  categories: [],
  products: [],
  salesOrders: [],
  purchaseOrders: [],
  invoices: [],
  tickets: [],
  quotes: [],
  pricingRules: [],
  quoteHistory: [],
  vehicles: [],
  tasks: [],
  teams: [],
  users: [],
  rolePermissions: [],
  today: { tasks: [], meetings: [], overdueInvoices: [], lowStockSkus: [] },
  savedViews: {},
  settings: {
    role: 'Worker' as Role,
    locale: 'tr-TR',
    demoWatermark: false,
    notifications: { email: true, desktop: true, slack: false },
  },
}

const mapQuote = (q: any, idx = 0) => ({
  id: String(q.id ?? idx),
  documentType: q.document_type || 'Quote',
  number: q.number,
  customerId: String(q.customer ?? q.customer_id ?? ''),
  customerName: q.customer_name || '',
  owner: q.owner_name || 'N/A',
  preparedById: q.prepared_by ? String(q.prepared_by) : undefined,
  preparedByName: q.prepared_by_name || '',
  sellerCompanyKey: q.seller_company_key || '',
  status: q.status,
  validUntil: q.valid_until,
  total: Number(q.total ?? 0),
  subtotal: Number(q.subtotal ?? 0),
  discountTotal: Number(q.discount_total ?? 0),
  taxTotal: Number(q.tax_total ?? 0),
  currency: q.currency || 'TRY',
  vatRate: Number(q.vat_rate ?? 20),
  createdAt: q.created_at,
  updatedAt: q.updated_at,
  contractConfig: q.contract_config || {},
  lines: (q.lines || []).map((l: any) => ({
    id: l.id ? String(l.id) : undefined,
    productId: l.product ? String(l.product) : undefined,
    sku: l.product_sku || l.details?.code || l.name,
    name: l.name,
    sectionKey: l.section_key || '',
    qty: Number(l.qty ?? 0),
    unitPrice: Number(l.unit_price ?? 0),
    discount: Number(l.discount ?? 0),
    discountSecondary: Number(l.discount_secondary ?? 0),
    tax: Number(l.tax ?? 0),
    unit: l.unit || '',
    category: l.section_key || '',
    details: l.details || {},
  })),
  approval: [],
  history: [],
  terms: { payment: q.payment_terms || '', delivery: q.delivery_terms || '', notes: q.notes || '' },
})

const serializeCompanyPayload = (payload: Partial<Company>) => ({
  name: payload.name || '',
  group: payload.industry || '',
  city: payload.region || '',
  country: normalizeCountryLabel(payload.country),
  currency: resolveCompanyCurrency(payload.currency, payload.country),
  size: normalizeCompanySize(payload.size),
  address: payload.address || '',
  tax_office: payload.taxOffice || '',
  tax_number: payload.taxNumber || '',
  authorized_person: payload.authorizedPerson || '',
  phone: payload.phone || '',
  email: payload.email || '',
})

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  data: emptySnapshot,
  resetDemo: () => set(() => ({ data: emptySnapshot })),
  logAccess: (action, meta) => {
    try {
      const logs = JSON.parse(localStorage.getItem('access-log') || '[]')
      const entry = { action, meta, at: new Date().toISOString() }
      localStorage.setItem('access-log', JSON.stringify([entry, ...logs].slice(0, 200)))
    } catch {
      /* ignore */
    }
  },
  startSse: () => {
    let timer: any
    const stop = startSseClient((ev) => {
      const t = ev?.type || ''
      if (timer) clearTimeout(timer)

      if (t.startsWith('quote.')) {
        timer = setTimeout(async () => {
          try {
            const quotesRes = await api.get('/quotes/')
            const quotes = (quotesRes.data || []).map((q: any, idx: number) => mapQuote(q, idx))
            set((state) => ({ data: { ...state.data, quotes } }))
          } catch (err) {
            console.error('SSE quote refresh failed', err)
          }
        }, 300)
        return
      }
      // Mention / SLA / automation olaylarında sadece ilgili listeleri tazele
      const shouldHydrate =
        !t ||
        t.startsWith('task.') ||
        t.startsWith('notification.') ||
        t.startsWith('ticket.') ||
        t.startsWith('orders.')
      if (shouldHydrate) {
        timer = setTimeout(() => {
          get().hydrateFromApi()
        }, 500)
      }
    })
    return stop
  },
  hydrateFromApi: async () => {
    try {
      const meRes = await api.get('/auth/me/')
      const userRole = meRes.data?.role as Role | undefined
      // current user bilgilerini lokal sakla (UI tarafında filtre varsayılanları için)
      if (meRes.data?.id) {
        try {
          localStorage.setItem('current-user-id', String(meRes.data.id))
        } catch {
          /* ignore */
        }
      }
      try {
        localStorage.setItem('current-user-role', String(userRole || 'Worker'))
      } catch {
        /* ignore */
      }
      // Role bilgisini hemen state'e yaz (UI guard’ları için)
      set((state) => ({
        data: { ...state.data, settings: { ...state.data.settings, role: (userRole as Role) || 'Worker' } },
      }))

      // Worker: gereksiz endpointlere gitme (403). Sıra ASLA değişmemeli — aşağıdaki dizi,
      // products → … → salesOrders → teams → users → tasks eşlemesiyle aynı olmalı.
      const isWorkerRole = (userRole || 'Worker') === 'Worker'
      const emptyList = Promise.resolve({ data: [] })
      const settled = await Promise.allSettled([
        isWorkerRole ? emptyList : api.get('/products/'),
        isWorkerRole ? emptyList : api.get('/categories/'),
        isWorkerRole ? emptyList : api.get('/quotes/'),
        isWorkerRole ? emptyList : api.get('/partners/'),
        isWorkerRole ? emptyList : api.get('/contacts/'),
        isWorkerRole ? emptyList : api.get('/leads/'),
        isWorkerRole ? emptyList : api.get('/opportunities/'),
        isWorkerRole ? emptyList : api.get('/tickets/'),
        isWorkerRole ? emptyList : api.get('/vehicles/'),
        isWorkerRole ? emptyList : api.get('/sales-orders/'),
        api.get('/teams/'),
        api.get('/auth/users/'),
        api.get('/tasks/'),
      ])
      const [
        productsRes,
        categoriesRes,
        quotesRes,
        partnersRes,
        contactsRes,
        leadsRes,
        oppRes,
        ticketsRes,
        vehiclesRes,
        salesOrdersRes,
        teamsRes,
        usersRes,
        tasksRes,
      ] = settled.map((r: any) => (r.status === 'fulfilled' ? r.value : { data: [] }))
      const categories = (categoriesRes.data || []).map((category: any, idx: number) => ({
        id: String(category.id ?? idx),
        name: category.name || '',
        templateDefaults: category.template_defaults || {},
        attributeSchema: category.attribute_schema || [],
      }))
      const products = (productsRes.data || []).map((p: any, idx: number) => ({
        id: String(p.id ?? idx),
        sku: p.sku || p.name || `SKU-${idx}`,
        name: p.name,
        category: p.category_name || '',
        categoryId: p.category ? String(p.category) : undefined,
        categoryName: p.category_name || '',
        stock: Number(p.stock ?? 0),
        reserved: Number(p.reserved ?? 0),
        reorderPoint: Number(p.reorder_point ?? 0),
        warehouse: '',
        price: Number(p.price ?? 0),
        templateFamily: p.template_defaults?.template_family || p.category_template_defaults?.template_family || '',
        templateDefaults: p.template_defaults || {},
        categoryTemplateDefaults: p.category_template_defaults || {},
        categoryAttributeSchema: p.category_attribute_schema || [],
        resolvedAttributeSchema: p.resolved_attribute_schema || [],
        attributeValues: p.attribute_values || {},
        attributeSchemaOverride: p.attribute_schema_override || [],
      }))
      const companies = (partnersRes.data || []).map((c: any, idx: number) => ({
        id: String(c.id ?? idx),
        name: c.name,
        industry: c.group || '',
        region: c.city || '',
        country: normalizeCountryLabel(c.country),
        size: normalizeCompanySize(c.size),
        owner: 'N/A',
        rating: 0,
        currency: resolveCompanyCurrency(c.currency, c.country),
        annualRevenue: 0,
        address: c.address || '',
        taxOffice: c.tax_office || '',
        taxNumber: c.tax_number || '',
        authorizedPerson: c.authorized_person || '',
        phone: c.phone || '',
        email: c.email || '',
      }))
      const quotes = (quotesRes.data || []).map((q: any, idx: number) => mapQuote(q, idx))
      const leads = (leadsRes.data || []).map((l: any, idx: number) => ({
        id: String(l.id ?? idx),
        name: l.name,
        title: l.title || '',
        companyId: String(l.company ?? ''),
        email: l.email || '',
        phone: l.phone || '',
        owner: l.owner_name || '',
        status: l.status || 'New',
        source: l.source || '',
        score: Number(l.score ?? 0),
        createdAt: l.created_at || new Date().toISOString(),
        tags: [],
        timeline: [],
      }))
      const opportunities = (oppRes.data || []).map((o: any, idx: number) => ({
        id: String(o.id ?? idx),
        name: o.name,
        leadId: o.lead ? String(o.lead) : undefined,
        companyId: o.company ? String(o.company) : undefined,
        owner: o.owner_name || '',
        stage: o.stage || 'Qualification',
        value: Number(o.value ?? 0),
        probability: Number(o.probability ?? 0),
        closeDate: o.close_date || '',
        products: [],
        history: [],
      }))
      const tickets = (ticketsRes.data || []).map((t: any, idx: number) => ({
        id: String(t.id ?? idx),
        subject: t.subject,
        companyId: String(t.company ?? ''),
        status: t.status,
        priority: t.priority,
        assignee: t.assignee_name || '',
        sla: t.sla || '',
        updatedAt: t.updated_at || new Date().toISOString(),
        thread: (t.messages || []).map((m: any, mi: number) => ({
          id: String(m.id ?? mi),
          author: m.author_name || 'System',
          message: m.message,
          time: m.created_at || new Date().toISOString(),
          internal: m.internal,
        })),
      }))
      const contacts = (contactsRes.data || []).map((c: any, idx: number) => ({
        id: String(c.id ?? idx),
        companyId: String(c.company ?? ''),
        name: c.name,
        role: c.role || '',
        email: c.email || '',
        phone: c.phone || '',
        owner: c.owner || '',
      }))
      const vehicles = (vehiclesRes.data || []).map((v: any, idx: number) => ({
        id: String(v.id ?? idx),
        name: v.name,
        plate: v.plate,
        driver: v.driver || '',
        status: v.status || 'Yolda',
        location: { city: v.location_city || '', lat: Number(v.location_lat ?? 0), lng: Number(v.location_lng ?? 0) },
        distanceToday: Number(v.distance_today ?? 0),
        avgSpeed: Number(v.avg_speed ?? 0),
        idleMinutes: Number(v.idle_minutes ?? 0),
        stops: Number(v.stops ?? 0),
        eta: v.eta,
        temperature: v.temperature ? Number(v.temperature) : undefined,
      }))
      const salesOrders = ((salesOrdersRes as any)?.data || []).map((so: any, idx: number) => ({
        id: String(so.id ?? idx),
        number: so.number,
        customerId: so.customer ? String(so.customer) : '',
        customerName: so.customer_name || '',
        status: so.status || 'Draft',
        amount: Number(so.amount ?? 0),
        shippingDate: so.shipping_date || '',
        expectedDelivery: so.expected_delivery || '',
        orderQuantity: Number(so.order_quantity ?? 0),
        quantityProduced: Number(so.quantity_produced ?? 0),
      }))
      const teams: Team[] = (teamsRes.data || []).map((t: any, idx: number) => ({
        id: String(t.id ?? idx),
        name: t.name,
        memberIds: (t.members || []).map((m: any) => String(m)),
        leaderId: t.leader != null && t.leader !== '' ? String(t.leader) : undefined,
      }))
      const users: UserLite[] = (usersRes.data || []).map((u: any) => ({
        id: String(u.id),
        username: u.username,
        email: u.email || '',
        role: u.role,
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        fullName: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username,
        permissions: u.permissions || [],
        canPrepareQuotes: Boolean(u.can_prepare_quotes),
      }))
      const currentUserPermissions =
        users.find((user) => String(user.id) === String(meRes.data?.id))?.permissions || []
      const tasks: Task[] = (tasksRes.data || []).map((t: any, idx: number) => ({
        id: String(t.id ?? idx),
        title: t.title,
        owner: String(t.owner ?? ''),
        assignee: t.assignee ? String(t.assignee) : '',
        teamId: t.team ? String(t.team) : undefined,
        currentTeam: t.current_team ? String(t.current_team) : undefined,
        workflowTeamIds: (t.workflow_team_ids || []).map((id: any) => String(id)),
        workflowParallel: Boolean(t.workflow_parallel),
        workflowStageTargets: (t.workflow_stage_targets || []).map((x: any) => Number(x)),
        workflowStageState: t.workflow_stage_state || {},
        salesOrder: t.sales_order != null && t.sales_order !== '' ? String(t.sales_order) : undefined,
        mode: t.mode,
        modelCode: t.model_code ? String(t.model_code) : undefined,
        variant: t.variant ? String(t.variant) : undefined,
        quantity: t.quantity != null ? Number(t.quantity) : undefined,
        modelDurationMinutes: t.model_duration_minutes != null ? Number(t.model_duration_minutes) : undefined,
        totalPlannedMinutes: t.total_planned_minutes != null ? Number(t.total_planned_minutes) : undefined,
        modelBladeDepth: t.model_blade_depth ? String(t.model_blade_depth) : undefined,
        modelSizes: Array.isArray(t.model_sizes) ? t.model_sizes : [],
        productColor:
          t.product_color != null && String(t.product_color).trim() !== ''
            ? String(t.product_color).trim()
            : t.productColor != null && String(t.productColor).trim() !== ''
              ? String(t.productColor).trim()
              : undefined,
        productColorCode:
          t.product_color_code != null && String(t.product_color_code).trim() !== ''
            ? String(t.product_color_code).trim()
            : t.productColorCode != null && String(t.productColorCode).trim() !== ''
              ? String(t.productColorCode).trim()
              : undefined,
        productLines: Array.isArray(t.product_lines)
          ? t.product_lines.map((ln: any) => mapApiProductLineToTask(ln))
          : undefined,
        activeProductIndex:
          t.active_product_index != null && t.active_product_index !== ''
            ? Number(t.active_product_index)
            : t.activeProductIndex != null
              ? Number(t.activeProductIndex)
              : undefined,
        status: t.status,
        priority: t.priority,
        start: t.start,
        end: t.end,
        due: t.due,
        tags: t.tags || [],
        plannedHours: t.planned_hours ? Number(t.planned_hours) : undefined,
        plannedCost: t.planned_cost ? Number(t.planned_cost) : undefined,
        attachments: (t.attachments || []).map((a: any) => ({
          id: String(a.id),
          file: a.file,
          description: a.description,
          fileName: a.original_name,
          contentType: a.content_type,
          size: a.size,
          version: a.version,
          parent: a.parent ? String(a.parent) : undefined,
          uploadedBy: a.uploaded_by ? String(a.uploaded_by) : undefined,
          uploadedAt: a.uploaded_at,
          tags: a.tags || [],
        })),
        comments: (t.comments || []).map((c: any) => ({
          id: String(c.id),
          text: c.text,
          type: c.type,
          createdAt: c.created_at,
          author: c.author ? String(c.author) : undefined,
          authorName: c.author_name,
        })),
        checklist: (t.checklist || []).map((ck: any) => ({
          id: String(ck.id),
          title: ck.title,
          done: Boolean(ck.done),
          order: ck.order,
          createdAt: ck.created_at,
          workflowTeamId:
            ck.workflow_team != null && ck.workflow_team !== undefined
              ? String(ck.workflow_team)
              : undefined,
        })),
        time_entries: (t.time_entries || []).map((te: any) => ({
          id: String(te.id),
          task: String(te.task),
          user: te.user ? String(te.user) : undefined,
          user_name: te.user_name,
          started_at: te.started_at,
          ended_at: te.ended_at,
          note: te.note,
          created_at: te.created_at,
        })),
        history: (t.history || []).map((h: any, hi: number) => ({
          id: String(h.id ?? hi),
          text: h.text || '',
          actor: h.actor || '',
          at: h.at || h.created_at || '',
        })),
        productionEntries: (t.production_entries || []).map((pe: any) => ({
          id: String(pe.id),
          task: String(pe.task),
          user: pe.user != null ? String(pe.user) : undefined,
          userName: pe.user_name,
          team: pe.team != null ? String(pe.team) : undefined,
          teamName: pe.team_name,
          productLineIndex:
            pe.product_line_index != null && pe.product_line_index !== ''
              ? Number(pe.product_line_index)
              : undefined,
          entryDate: pe.entry_date || '',
          quantity: Number(pe.quantity ?? 0),
          note: pe.note,
          createdAt: pe.created_at,
        })),
      }))
      set((state) => ({
        data: {
          ...state.data,
          settings: { ...state.data.settings, role: userRole ?? state.data.settings.role },
          rolePermissions: currentUserPermissions,
          products,
          companies,
          contacts,
          categories,
          quotes,
          leads,
          opportunities,
          tickets,
          vehicles,
          salesOrders,
          teams,
          users,
          tasks,
        },
      }))
    } catch (err: any) {
      console.error('API hydrate failed', err)
      const status = err?.response?.status
      const isLogin = typeof window !== 'undefined' && window.location.pathname.startsWith('/login')
      if ((status === 401 || status === 403) && getTokens() && !isLogin) {
        try {
          clearTokens()
        } catch {}
        window.location.replace('/login')
      }
    }
  },
  setRole: (role) =>
    set((state) => ({
      data: { ...state.data, settings: { ...state.data.settings, role } },
    })),
  setLocale: (locale) =>
    set((state) => ({
      data: { ...state.data, settings: { ...state.data.settings, locale } },
    })),
  createLead: (payload) =>
    (async () => {
      try {
        await api.post('/leads/', payload)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API createLead failed', err)
      }
    })(),
  createCompany: async (payload) => {
    try {
      const res = await api.post('/partners/', serializeCompanyPayload(payload))
      await get().hydrateFromApi()
      const companies = get().data.companies
      const createdId = res.data?.id
      if (createdId !== undefined && createdId !== null) {
        return companies.find((company) => company.id === String(createdId))
      }
      return (
        companies.find(
          (company) =>
            company.name === payload.name &&
            (!payload.email || company.email === payload.email) &&
            (!payload.phone || company.phone === payload.phone)
        ) ?? companies[companies.length - 1]
      )
    } catch (err) {
      console.error('API createCompany failed', err)
      throw err
    }
  },
  updateCompany: async (id, patch) => {
    try {
      await api.patch(`/partners/${id}/`, serializeCompanyPayload(patch))
      await get().hydrateFromApi()
    } catch (err) {
      console.error('API updateCompany failed', err)
      throw err
    }
  },
  createContact: async (payload) => {
    try {
      await api.post('/contacts/', payload)
      await get().hydrateFromApi()
    } catch (err) {
      console.error('API createContact failed', err)
      throw err
    }
  },
  createOpportunity: (payload) =>
    (async () => {
      try {
        await api.post('/opportunities/', payload)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API createOpportunity failed', err)
      }
    })(),
  updateLead: (id, patch) =>
    (async () => {
      try {
        await api.patch(`/leads/${id}/`, patch)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API updateLead failed', err)
      }
    })(),
  deleteLead: (id) =>
    (async () => {
      try {
        await api.delete(`/leads/${id}/`)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API deleteLead failed', err)
      }
    })(),
  updateOpportunity: (id, patch) =>
    (async () => {
      try {
        await api.patch(`/opportunities/${id}/`, patch)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API updateOpportunity failed', err)
      }
    })(),
  updateOpportunityStage: (id, stage) =>
    (async () => {
      const prev = get().data.opportunities
      const optimistic = prev.map((o) => (String(o.id) === String(id) ? { ...o, stage } : o))
      set((state) => ({ data: { ...state.data, opportunities: optimistic } }))
      
      try {
        await api.patch(`/opportunities/${id}/`, {
          stage,
          history: [{ stage, date: new Date().toISOString() }],
        })
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API updateOpportunityStage failed', err)
        set((state) => ({ data: { ...state.data, opportunities: prev } }))
        
        // CRITICAL: Kullanıcıyı bilgilendir
        import('@/components/ui/use-toast').then(({ toast }) => {
          toast({
            title: 'Değişiklik Kaydedilemedi',
            description: 'Fırsat aşaması güncellenemedi, lütfen tekrar deneyin',
            variant: 'destructive',
          })
        })
      }
    })(),
  addTicketMessage: (id, message) =>
    (async () => {
      try {
        await api.post('/ticket-messages/', {
          ticket: id,
          message: message.message,
          internal: message.internal,
        })
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API addTicketMessage failed', err)
      }
    })(),
  updateTicket: (id, patch) =>
    (async () => {
      try {
        await api.patch(`/tickets/${id}/`, patch)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API updateTicket failed', err)
      }
    })(),
  markInvoiceStatus: (id, status) =>
    (async () => {
      try {
        await api.patch(`/invoices/${id}/`, { status })
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API markInvoiceStatus failed', err)
      }
    })(),
  addInvoicePayment: (id, payment) =>
    (async () => {
      try {
        await api.patch(`/invoices/${id}/`, {
          payments: [payment],
        })
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API addInvoicePayment failed', err)
      }
    })(),
  adjustInventory: (sku, delta) =>
    (async () => {
      const prev = get().data.products
      const optimistic = prev.map((p) => 
        p.sku === sku ? { ...p, stock: p.stock + delta } : p
      )
      set((state) => ({ data: { ...state.data, products: optimistic } }))
      
      try {
        await api.post('/stock-movements/', {
          movement_type: delta >= 0 ? 'IN' : 'OUT',
          quantity: Math.abs(delta),
          reference: `UI-${Date.now()}`,
          sku,
        })
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API adjustInventory failed', err)
        set((state) => ({ data: { ...state.data, products: prev } }))
        
        // CRITICAL: Kullanıcıyı bilgilendir
        import('@/components/ui/use-toast').then(({ toast }) => {
          toast({
            title: 'Değişiklik Kaydedilemedi',
            description: 'Stok güncellenemedi, lütfen tekrar deneyin',
            variant: 'destructive',
          })
        })
      }
    })(),
  upsertProduct: async (product) => {
    try {
      const payload: any = { ...product }
      if (!payload.sku) payload.sku = ''
      payload.category = payload.categoryId || payload.category || null
      delete payload.categoryId
      if ((product as any).id) {
        await api.patch(`/products/${(product as any).id}/`, payload)
      } else {
        await api.post('/products/', payload)
      }
      await get().hydrateFromApi()
    } catch (err) {
      console.error('API upsertProduct failed', err)
      throw err
    }
  },
  deleteProduct: async (id) => {
    try {
      await api.delete(`/products/${id}/`)
      set((state) => ({
        data: {
          ...state.data,
          products: state.data.products.filter((product) => product.id !== id),
        },
      }))
    } catch (err) {
      console.error('API deleteProduct failed', err)
      throw err
    }
  },
  upsertCategory: async (category) => {
    try {
      const payload: any = {
        name: category.name || '',
        template_defaults: (category as any).templateDefaults || {},
        attribute_schema: (category as any).attributeSchema || [],
      }
      if ((category as any).id) {
        await api.patch(`/categories/${(category as any).id}/`, payload)
      } else {
        await api.post('/categories/', payload)
      }
      await get().hydrateFromApi()
    } catch (err) {
      console.error('API upsertCategory failed', err)
      throw err
    }
  },
  bulkUpsertProducts: async (payload) => {
    try {
      const response = await api.post('/products/bulk-upsert/', payload)
      await get().hydrateFromApi()
      return response.data
    } catch (err) {
      console.error('API bulkUpsertProducts failed', err)
      throw err
    }
  },
  syncTemplateCatalogToInventory: async () => {
    try {
      const payload = buildTemplateCatalogImportPayload()
      const response = await api.post('/products/import-template-catalog/', payload)
      await get().hydrateFromApi()
      return response.data
    } catch (err) {
      console.error('API syncTemplateCatalogToInventory failed', err)
      throw err
    }
  },
  createVehicle: (payload) =>
    (async () => {
      try {
        await api.post('/vehicles/', payload)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API createVehicle failed', err)
      }
    })(),
  createSalesOrder: (payload) =>
    (async () => {
      try {
        await api.post('/sales-orders/', payload)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API createSalesOrder failed', err)
      }
    })(),
  createTask: async (task) => {
    try {
      const t = task as any
      const lines = t.productLines as any[] | undefined
      const activeIdx = Number(t.activeProductIndex ?? 0)
      const activeLine = lines?.length ? lines[Math.min(Math.max(0, activeIdx), lines.length - 1)] : null

      const dateOrNull = (v: unknown): string | null =>
        v != null && typeof v === 'string' && String(v).trim() !== '' ? String(v) : null

      const wfIds = (t.workflowTeamIds || [])
        .filter((id: string) => id != null && id !== '')
        .map((id: string) => Number(id))
        .filter((n: number) => !Number.isNaN(n))
      const wfTargets = (t.workflowStageTargets || []).map((n: any) => Number(n)).filter((n: number) => !Number.isNaN(n))

      const q = Number(activeLine?.quantity ?? t.quantity ?? 1)
      const qty = Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1
      const mdur = Number(activeLine?.modelDurationMinutes ?? t.modelDurationMinutes ?? 0)
      const tpm = Number(activeLine?.totalPlannedMinutes ?? t.totalPlannedMinutes ?? 0)
      const ph = Number(t.plannedHours ?? 0)
      const pc = Number(t.plannedCost ?? 0)

      const payload: Record<string, unknown> = {
        title: t.title,
        owner: t.owner ? Number(t.owner) : null,
        assignee: t.assignee ? Number(t.assignee) : null,
        team: t.teamId ? Number(t.teamId) : null,
        status: t.status ?? 'todo',
        priority: t.priority ?? 'medium',
        start: dateOrNull(t.start),
        end: dateOrNull(t.end),
        due: dateOrNull(t.due),
        planned_hours: Number.isFinite(ph) ? ph : 0,
        planned_cost: Number.isFinite(pc) ? pc : 0,
        mode: (activeLine?.mode as string) || t.mode || 'manual',
        model_code: (activeLine?.modelCode as string) || t.modelCode || '',
        variant: (activeLine?.variant as string) || t.variant || '',
        quantity: qty,
        model_duration_minutes: Number.isFinite(mdur) && mdur >= 0 ? mdur : 0,
        total_planned_minutes: Number.isFinite(tpm) && tpm >= 0 ? tpm : 0,
        model_blade_depth: (activeLine?.modelBladeDepth as string) || t.modelBladeDepth || '',
        model_sizes: activeLine?.modelSizes || t.modelSizes || [],
        product_color: String(activeLine?.productColor ?? t.productColor ?? '').trim(),
        product_color_code: String(activeLine?.productColorCode ?? t.productColorCode ?? '').trim(),
        workflow_team_ids: wfIds,
        workflow_parallel: t.workflowParallel === true,
        workflow_stage_targets: wfTargets,
        sales_order: t.salesOrderId ? Number(t.salesOrderId) : null,
      }
      if (lines && lines.length > 0) {
        payload.product_lines = taskProductLinesToApiPayload(lines as any)
        payload.active_product_index = Math.min(Math.max(0, activeIdx), lines.length - 1)
      }
      await api.post('/tasks/', payload)
      await get().hydrateFromApi()
    } catch (err) {
      console.error('API createTask failed', err)
      throw err
    }
  },
  updateTask: (id, patch) =>
    (async () => {
      const prev = get().data.tasks
      const optimistic = prev.map((t) => (String(t.id) === String(id) ? { ...t, ...patch } : t))
      set((state) => ({ data: { ...state.data, tasks: optimistic } }))
      try {
        const payload: any = { ...patch }
        if ('owner' in payload) payload.owner = payload.owner ? Number(payload.owner) : null
        if ('assignee' in payload) payload.assignee = payload.assignee ? Number(payload.assignee) : null
        if ('teamId' in payload) {
          payload.team = payload.teamId ? Number(payload.teamId) : null
          delete payload.teamId
        }
        if ('plannedHours' in payload) payload.planned_hours = (payload as any).plannedHours
        if ('plannedCost' in payload) payload.planned_cost = (payload as any).plannedCost
        if ('mode' in payload) payload.mode = (payload as any).mode
        if ('modelCode' in payload) payload.model_code = (payload as any).modelCode
        if ('variant' in payload) payload.variant = (payload as any).variant
        if ('quantity' in payload) payload.quantity = (payload as any).quantity
        if ('modelDurationMinutes' in payload) payload.model_duration_minutes = (payload as any).modelDurationMinutes
        if ('totalPlannedMinutes' in payload) payload.total_planned_minutes = (payload as any).totalPlannedMinutes
        if ('modelBladeDepth' in payload) payload.model_blade_depth = (payload as any).modelBladeDepth
        if ('modelSizes' in payload) payload.model_sizes = (payload as any).modelSizes
        if ('productColor' in payload) {
          payload.product_color = String((payload as any).productColor ?? '')
          delete (payload as any).productColor
        }
        if ('productColorCode' in payload) {
          payload.product_color_code = String((payload as any).productColorCode ?? '')
          delete (payload as any).productColorCode
        }
        if ('workflowTeamIds' in payload) {
          payload.workflow_team_ids = Array.isArray(payload.workflowTeamIds)
            ? payload.workflowTeamIds.map((id: string) => Number(id))
            : []
          delete payload.workflowTeamIds
        }
        if ('workflowParallel' in payload) {
          payload.workflow_parallel = Boolean((payload as any).workflowParallel)
          delete (payload as any).workflowParallel
        }
        if ('workflowStageTargets' in payload) {
          payload.workflow_stage_targets = ((payload as any).workflowStageTargets || []).map((n: any) => Number(n))
          delete (payload as any).workflowStageTargets
        }
        if ('salesOrderId' in payload) {
          const sid = (payload as any).salesOrderId
          payload.sales_order = sid ? Number(sid) : null
          delete (payload as any).salesOrderId
        }
        if ('productLines' in payload && Array.isArray((payload as any).productLines)) {
          const pl = (payload as any).productLines as any[]
          payload.product_lines = taskProductLinesToApiPayload(pl)
          delete (payload as any).productLines
        }
        if ('activeProductIndex' in payload) {
          payload.active_product_index = Number((payload as any).activeProductIndex ?? 0)
          delete (payload as any).activeProductIndex
        }
        await api.patch(`/tasks/${id}/`, payload)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API updateTask failed', err)
        set((state) => ({ data: { ...state.data, tasks: prev } }))
        
        // CRITICAL: Kullanıcıyı bilgilendir
        import('@/components/ui/use-toast').then(({ toast }) => {
          toast({
            title: 'Değişiklik Kaydedilemedi',
            description: 'Görev güncellenemedi, lütfen tekrar deneyin',
            variant: 'destructive',
          })
        })
      }
    })(),

  // Kanban/status sürükle-bırak optimistik: sadece status + optional priority/assignee
  moveTask: (id, statusPatch) =>
    (async () => {
      const prev = get().data.tasks
      const optimistic = prev.map((t) => (String(t.id) === String(id) ? { ...t, ...statusPatch } : t))
      set((state) => ({ data: { ...state.data, tasks: optimistic } }))
      try {
        await api.patch(`/tasks/${id}/`, statusPatch)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API moveTask failed', err)
        set((state) => ({ data: { ...state.data, tasks: prev } }))
        
        // CRITICAL: Kullanıcıyı bilgilendir
        import('@/components/ui/use-toast').then(({ toast }) => {
          toast({
            title: 'Değişiklik Kaydedilemedi',
            description: 'Görev durumu güncellenemedi, lütfen tekrar deneyin',
            variant: 'destructive',
          })
        })
      }
    })(),
  deleteTask: (id) =>
    (async () => {
      try {
        await api.delete(`/tasks/${id}/`)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API deleteTask failed', err)
      }
    })(),
  addTaskComment: (payload) =>
    (async () => {
      try {
        await api.post('/task-comments/', payload)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API addTaskComment failed', err)
      }
    })(),
  addChecklistItem: (payload) =>
    (async () => {
      try {
        await api.post('/task-checklist/', payload)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API addChecklistItem failed', err)
      }
    })(),
  toggleChecklistItem: (id, done) =>
    (async () => {
      const prev = get().data.tasks
      const optimistic = prev.map((t) => ({
        ...t,
        checklist: (t as any).checklist?.map((c: any) => (c.id === id ? { ...c, done } : c)),
      }))
      set((state) => ({ data: { ...state.data, tasks: optimistic } }))
      try {
        await api.patch(`/task-checklist/${id}/`, { done })
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API toggleChecklistItem failed', err)
        set((state) => ({ data: { ...state.data, tasks: prev } }))
        
        // CRITICAL: Kullanıcıyı bilgilendir
        import('@/components/ui/use-toast').then(({ toast }) => {
          toast({
            title: 'Değişiklik Kaydedilemedi',
            description: 'Checklist güncellenemedi, lütfen tekrar deneyin',
            variant: 'destructive',
          })
        })
      }
    })(),
  deleteChecklistItem: (id) =>
    (async () => {
      try {
        await api.delete(`/task-checklist/${id}/`)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API deleteChecklistItem failed', err)
      }
    })(),
  reorderChecklistItems: (taskId, orderedIds) =>
    (async () => {
      try {
        await api.post('/task-checklist/reorder/', { task: taskId, order: orderedIds })
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API reorderChecklistItems failed', err)
      }
    })(),
  deleteAttachment: (id) =>
    (async () => {
      try {
        await api.delete(`/task-attachments/${id}/`)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API deleteAttachment failed', err)
      }
    })(),
  updateAttachment: (id, patch) =>
    (async () => {
      try {
        await api.patch(`/task-attachments/${id}/`, patch)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API updateAttachment failed', err)
      }
    })(),
  addTimeEntry: (payload) =>
    (async () => {
      try {
        await api.post('/task-time-entries/', payload)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API addTimeEntry failed', err)
      }
    })(),
  createQuote: async (payload) => {
    try {
      const response = await api.post('/quotes/', payload)
      const createdQuote = mapQuote(response.data)
      set((state) => ({
        data: {
          ...state.data,
          quotes: [createdQuote, ...state.data.quotes.filter((quote) => quote.id !== createdQuote.id)],
        },
      }))
    } catch (err) {
      console.error('API createQuote failed', err)
      throw err
    }
  },
  updateQuote: async (id, patch) => {
    try {
      const response = await api.patch(`/quotes/${id}/`, patch)
      const updatedQuote = mapQuote(response.data)
      set((state) => ({
        data: {
          ...state.data,
          quotes: state.data.quotes.map((quote) => (quote.id === id ? updatedQuote : quote)),
        },
      }))
    } catch (err) {
      console.error('API updateQuote failed', err)
      throw err
    }
  },
  sendQuote: async (id) => {
    try {
      const response = await api.post(`/quotes/${id}/send/`)
      const updatedQuote = response.data?.quote ? mapQuote(response.data.quote) : null
      set((state) => ({
        data: {
          ...state.data,
          quotes: state.data.quotes.map((quote) =>
            quote.id === id ? updatedQuote || { ...quote, status: 'Sent' as Quote['status'] } : quote
          ),
        },
      }))
    } catch (err) {
      console.error('API sendQuote failed', err)
      throw err
    }
  },
  requestQuoteApproval: async (id) => {
    try {
      await api.post(`/quotes/${id}/request_approval/`)
      set((state) => ({
        data: {
          ...state.data,
          quotes: state.data.quotes.map((quote) =>
            quote.id === id ? { ...quote, status: 'Under Review' as Quote['status'] } : quote
          ),
        },
      }))
    } catch (err) {
      console.error('API requestQuoteApproval failed', err)
      throw err
    }
  },
  deleteQuotes: async (ids) => {
    try {
      await Promise.all(ids.map((id) => api.delete(`/quotes/${id}/`)))
      set((state) => ({
        data: {
          ...state.data,
          quotes: state.data.quotes.filter((quote) => !ids.includes(quote.id)),
        },
      }))
    } catch (err) {
      console.error('API deleteQuotes failed', err)
      throw err
    }
  },
  convertQuote: async (id) => {
    try {
      const response = await api.post(`/quotes/${id}/convert/`)
      const sourceQuote = response.data?.source ? mapQuote(response.data.source) : null
      const contractQuote = response.data?.contract ? mapQuote(response.data.contract) : null
      set((state) => {
        const withoutSource: Quote[] = state.data.quotes.map((quote) =>
          quote.id === id ? (sourceQuote || { ...quote, status: 'Converted' as Quote['status'] }) : quote
        )
        const mergedQuotes = contractQuote
          ? [contractQuote, ...withoutSource.filter((quote) => quote.id !== contractQuote.id)]
          : withoutSource
        return {
          data: {
            ...state.data,
            quotes: mergedQuotes,
          },
        }
      })
      return contractQuote || undefined
    } catch (err) {
      console.error('API convertQuote failed', err)
      throw err
    }
  },
  upsertPricingRule: async (rule) => {
    try {
      if (rule.id) {
        await api.patch(`/pricing-rules/${rule.id}/`, rule)
      } else {
        await api.post('/pricing-rules/', rule)
      }
      await get().hydrateFromApi()
    } catch (err) {
      console.error('API upsertPricingRule failed', err)
    }
  },
  deletePricingRule: async (id) => {
    try {
      await api.delete(`/pricing-rules/${id}/`)
      await get().hydrateFromApi()
    } catch (err) {
      console.error('API deletePricingRule failed', err)
    }
  },
    }),
    {
      name: 'udar-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Sadece kritik verileri persist et, SSE ve geçici verileri hariç tut
        data: {
          ...state.data,
          // today verilerini persist etme (her seferinde API'den gelsin)
          today: { tasks: [], meetings: [], overdueInvoices: [], lowStockSkus: [] },
          // users ve teams'i persist etme (her zaman fresh data)
          users: [],
          teams: [],
        },
      }),
    }
  )
)


