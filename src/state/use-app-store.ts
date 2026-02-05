// @ts-nocheck
import { create } from 'zustand'

import api from '@/lib/api'
import { clearTokens, getTokens } from '@/lib/auth'
import type {
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
  TaskTimeEntry,
  Quote,
  PricingRule,
  SalesOrder,
} from '@/types'
import { startSse as startSseClient } from '@/lib/sse'

type AppState = {
  data: MockDbSnapshot
  resetDemo: () => void
  hydrateFromApi: () => Promise<void>
  startSse: () => void | (() => void)
  setRole: (role: Role) => void
  logAccess?: (action: string, meta?: Record<string, any>) => void
  toggleWatermark: (enabled: boolean) => void
  setLocale: (locale: MockDbSnapshot['settings']['locale']) => void
  createCompany: (payload: Omit<Company, 'id'>) => void
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
  upsertProduct: (product: Partial<Product> & { sku: string }) => void
  createVehicle: (payload: Omit<Vehicle, 'id' | 'last_update'>) => void
  createTask: (task: Omit<Task, 'id'>) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  addTaskComment: (payload: { task: string; text: string; type?: 'comment' | 'activity' }) => void
  addChecklistItem: (payload: { task: string; title: string }) => void
  toggleChecklistItem: (id: string, done: boolean) => void
  deleteAttachment: (id: string) => void
  updateAttachment: (id: string, patch: { description?: string }) => void
  addTimeEntry: (payload: { task: string; started_at: string; ended_at?: string; note?: string }) => void
  createQuote: (payload: Omit<Quote, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => void
  updateQuote: (id: string, patch: Partial<Quote>) => void
  deleteQuotes: (ids: string[]) => void
  convertQuote: (id: string) => Promise<SalesOrder | undefined>
  upsertPricingRule: (rule: PricingRule) => void
  deletePricingRule: (id: string) => void
}

const emptySnapshot: MockDbSnapshot = {
  version: 1,
  leads: [],
  opportunities: [],
  companies: [],
  contacts: [],
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
  number: q.number,
  customerId: String(q.customer ?? q.customer_id ?? ''),
  owner: q.owner_name || 'N/A',
  status: q.status,
  validUntil: q.valid_until,
  total: Number(q.total ?? 0),
  subtotal: Number(q.subtotal ?? 0),
  discountTotal: Number(q.discount_total ?? 0),
  taxTotal: Number(q.tax_total ?? 0),
  currency: q.currency || 'USD',
  createdAt: q.created_at,
  updatedAt: q.updated_at,
  lines: (q.lines || []).map((l: any) => ({
    sku: l.product || l.name,
    name: l.name,
    qty: Number(l.qty ?? 0),
    unitPrice: Number(l.unit_price ?? 0),
    discount: Number(l.discount ?? 0),
    tax: Number(l.tax ?? 0),
    category: l.product?.category?.name || '',
  })),
  approval: [],
  history: [],
  terms: { payment: q.payment_terms || '', delivery: q.delivery_terms || '' },
})

export const useAppStore = create<AppState>((set, get) => ({
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
      const t = ev?.type
      // Mention / SLA / automation olaylarında sadece ilgili listeleri tazele
      const shouldHydrate =
        !t ||
        t.startsWith('task.') ||
        t.startsWith('notification.') ||
        t.startsWith('ticket.') ||
        t.startsWith('quote.') ||
        t.startsWith('orders.')
      if (shouldHydrate) {
        if (timer) clearTimeout(timer)
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
      // Role bilgisini hemen state'e yaz (UI guard’ları için)
      set((state) => ({
        data: { ...state.data, settings: { ...state.data.settings, role: (userRole as Role) || 'Worker' } },
      }))

      // Role bazlı istek listesi; worker için sadece görev/ekip/kullanıcı
      // Worker için sadece gerekli endpointler (403 almamak için daraltılmış)
      const requests =
        userRole === 'Worker'
          ? {
              productsRes: Promise.resolve({ data: [] }),
              quotesRes: Promise.resolve({ data: [] }),
              partnersRes: Promise.resolve({ data: [] }),
              contactsRes: Promise.resolve({ data: [] }),
              leadsRes: Promise.resolve({ data: [] }),
              oppRes: Promise.resolve({ data: [] }),
              ticketsRes: Promise.resolve({ data: [] }),
              vehiclesRes: Promise.resolve({ data: [] }),
              teamsRes: api.get('/teams/'),
              usersRes: api.get('/auth/users/'),
              tasksRes: api.get('/tasks/'),
            }
          : {
              productsRes: api.get('/products/'),
              quotesRes: api.get('/quotes/'),
              partnersRes: api.get('/partners/'),
              contactsRes: api.get('/contacts/'),
              leadsRes: api.get('/leads/'),
              oppRes: api.get('/opportunities/'),
              ticketsRes: api.get('/tickets/'),
              vehiclesRes: api.get('/vehicles/'),
              salesOrdersRes: api.get('/sales-orders/'),
              teamsRes: api.get('/teams/'),
              usersRes: api.get('/auth/users/'),
              tasksRes: api.get('/tasks/'),
            }

      const settled = await Promise.allSettled(Object.values(requests))
      const [
        productsRes,
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
      const products = (productsRes.data || []).map((p: any, idx: number) => ({
        id: String(p.id ?? idx),
        sku: p.sku || p.name || `SKU-${idx}`,
        name: p.name,
        category: p.category?.name || '',
        stock: Number(p.stock ?? 0),
        reserved: Number(p.reserved ?? 0),
        reorderPoint: 0,
        warehouse: '',
        price: Number(p.price ?? 0),
      }))
      const companies = (partnersRes.data || []).map((c: any, idx: number) => ({
        id: String(c.id ?? idx),
        name: c.name,
        industry: c.group || '',
        region: c.city || '',
        size: 'Enterprise',
        owner: 'N/A',
        rating: 0,
        currency: 'USD',
        annualRevenue: 0,
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
      }))
      const teams: Team[] = (teamsRes.data || []).map((t: any, idx: number) => ({
        id: String(t.id ?? idx),
        name: t.name,
        memberIds: (t.members || []).map((m: any) => String(m)),
      }))
      const users: UserLite[] = (usersRes.data || []).map((u: any) => ({
        id: String(u.id),
        username: u.username,
        email: u.email,
        role: u.role,
      }))
      const tasks: Task[] = (tasksRes.data || []).map((t: any, idx: number) => ({
        id: String(t.id ?? idx),
        title: t.title,
        owner: String(t.owner ?? ''),
        assignee: t.assignee ? String(t.assignee) : '',
        teamId: t.team ? String(t.team) : undefined,
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
      }))
      set((state) => ({
        data: {
          ...state.data,
          settings: { ...state.data.settings, role: userRole ?? state.data.settings.role },
          products,
          companies,
          contacts,
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
  toggleWatermark: (enabled) =>
    set((state) => ({
      data: { ...state.data, settings: { ...state.data.settings, demoWatermark: enabled } },
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
      await api.post('/partners/', payload)
      await get().hydrateFromApi()
    } catch (err) {
      console.error('API createCompany failed', err)
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
      try {
        await api.patch(`/opportunities/${id}/`, {
          stage,
          history: [{ stage, date: new Date().toISOString() }],
        })
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API updateOpportunityStage failed', err)
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
      }
    })(),
  upsertProduct: async (product) => {
    try {
      const payload: any = { ...product }
      if (!payload.sku) payload.sku = ''
      if (!payload.category) {
        delete payload.category
      }
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
      const payload = {
        ...task,
        owner: task.owner ? Number(task.owner) : null,
        assignee: task.assignee ? Number(task.assignee) : null,
        team: task.teamId ? Number(task.teamId) : null,
        planned_hours: (task as any).plannedHours,
        planned_cost: (task as any).plannedCost,
      }
      delete (payload as any).teamId
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
        await api.patch(`/tasks/${id}/`, payload)
        await get().hydrateFromApi()
      } catch (err) {
        console.error('API updateTask failed', err)
        set((state) => ({ data: { ...state.data, tasks: prev } }))
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
      await api.post('/quotes/', payload)
      const quotesRes = await api.get('/quotes/')
      const quotes = (quotesRes.data || []).map((q: any, idx: number) => mapQuote(q, idx))
      set((state) => ({ data: { ...state.data, quotes } }))
    } catch (err) {
      console.error('API createQuote failed', err)
    }
  },
  updateQuote: async (id, patch) => {
    try {
      await api.patch(`/quotes/${id}/`, patch)
      const quotesRes = await api.get('/quotes/')
      const quotes = (quotesRes.data || []).map((q: any, idx: number) => mapQuote(q, idx))
      set((state) => ({ data: { ...state.data, quotes } }))
    } catch (err) {
      console.error('API updateQuote failed', err)
    }
  },
  deleteQuotes: async (ids) => {
    try {
      await Promise.all(ids.map((id) => api.delete(`/quotes/${id}/`)))
      const quotesRes = await api.get('/quotes/')
      const quotes = (quotesRes.data || []).map((q: any, idx: number) => mapQuote(q, idx))
      set((state) => ({ data: { ...state.data, quotes } }))
    } catch (err) {
      console.error('API deleteQuotes failed', err)
    }
  },
  convertQuote: async (id) => {
    try {
      await api.post(`/quotes/${id}/convert/`)
      await get().hydrateFromApi()
      return undefined
    } catch (err) {
      console.error('API convertQuote failed', err)
      return undefined
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
}))


