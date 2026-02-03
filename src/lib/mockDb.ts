import { nanoid } from 'nanoid'

import { buildSeed } from '@/data/mockData'
import type {
  MockDbSnapshot,
  Lead,
  Opportunity,
  Ticket,
  Invoice,
  SalesOrder,
  PurchaseOrder,
  Product,
  Task,
  Quote,
  PricingRule,
} from '@/types'

const STORAGE_KEY = 'canban-demo-v1'

const migrate = (snapshot: MockDbSnapshot): MockDbSnapshot => {
  const seed = buildSeed()
  const next: MockDbSnapshot = {
    ...snapshot,
    vehicles: snapshot.vehicles ?? seed.vehicles,
    tasks: snapshot.tasks ?? seed.tasks,
    quotes: snapshot.quotes ?? seed.quotes,
    pricingRules: snapshot.pricingRules ?? seed.pricingRules,
    quoteHistory: snapshot.quoteHistory ?? seed.quoteHistory,
    today: {
      ...seed.today,
      ...snapshot.today,
      tasks: snapshot.today?.tasks ?? seed.today.tasks,
    },
  }
  return next
}

const load = (): MockDbSnapshot => {
  if (typeof localStorage === 'undefined') return buildSeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildSeed()
    const parsed: MockDbSnapshot = JSON.parse(raw)
    return migrate(parsed)
  } catch (err) {
    console.warn('Failed to load demo data, using seed', err)
    return buildSeed()
  }
}

let snapshot = load()

const persist = (data: MockDbSnapshot) => {
  snapshot = data
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}

const clone = <T,>(value: T): T => structuredClone(value)

export const mockDb = {
  getSnapshot: () => snapshot,
  reset: () => {
    const seeded = buildSeed()
    persist(seeded)
    return seeded
  },
  quotes: {
    create: (payload: Omit<Quote, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => {
      const number = `Q-${Math.floor(20250 + Math.random() * 1000)}`
      const quote: Quote = {
        ...payload,
        id: nanoid(),
        number,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      persist({ ...snapshot, quotes: [quote, ...snapshot.quotes] })
      return quote
    },
    update: (id: string, patch: Partial<Quote>) => {
      persist({
        ...snapshot,
        quotes: snapshot.quotes.map((q) => (q.id === id ? { ...q, ...patch, updatedAt: new Date().toISOString() } : q)),
      })
      return snapshot.quotes.find((q) => q.id === id)
    },
    delete: (ids: string[]) => {
      persist({ ...snapshot, quotes: snapshot.quotes.filter((q) => !ids.includes(q.id)) })
    },
    addHistory: (id: string, history: Quote['history'][number]) => {
      persist({
        ...snapshot,
        quotes: snapshot.quotes.map((q) => (q.id === id ? { ...q, history: [history, ...q.history] } : q)),
        quoteHistory: [history, ...snapshot.quoteHistory],
      })
    },
    convertToSalesOrder: (id: string) => {
      const q = snapshot.quotes.find((x) => x.id === id)
      if (!q) return undefined
      const so: SalesOrder = {
        id: nanoid(),
        number: `SO-${Date.now()}`,
        customerId: q.customerId,
        status: 'Draft',
        amount: q.total,
        shippingDate: new Date().toISOString(),
        expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString(),
        items: q.lines.map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, price: l.unitPrice })),
      }
      persist({
        ...snapshot,
        quotes: snapshot.quotes.map((qq) => (qq.id === id ? { ...qq, status: 'Converted' } : qq)),
        salesOrders: [so, ...snapshot.salesOrders],
      })
      return so
    },
  },
  pricingRules: {
    upsert: (rule: PricingRule) => {
      const exists = snapshot.pricingRules.find((r) => r.id === rule.id)
      const rules = exists
        ? snapshot.pricingRules.map((r) => (r.id === rule.id ? rule : r))
        : [rule, ...snapshot.pricingRules]
      persist({ ...snapshot, pricingRules: rules })
      return rule
    },
    delete: (id: string) => {
      persist({ ...snapshot, pricingRules: snapshot.pricingRules.filter((r) => r.id !== id) })
    },
  },
  setSettings: (settings: MockDbSnapshot['settings']) => {
    const updated = { ...snapshot, settings }
    persist(updated)
    return updated
  },
  leads: {
    create: (payload: Omit<Lead, 'id' | 'createdAt' | 'timeline'>) => {
      const newLead: Lead = {
        ...payload,
        id: nanoid(),
        createdAt: new Date().toISOString(),
        timeline: [],
      }
      persist({ ...snapshot, leads: [newLead, ...snapshot.leads] })
      return newLead
    },
    update: (id: string, patch: Partial<Lead>) => {
      persist({
        ...snapshot,
        leads: snapshot.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      })
      return snapshot.leads.find((l) => l.id === id)
    },
    delete: (id: string) => {
      persist({
        ...snapshot,
        leads: snapshot.leads.filter((l) => l.id !== id),
      })
    },
  },
  opportunities: {
    create: (payload: Omit<Opportunity, 'id' | 'history'>) => {
      const opportunity: Opportunity = {
        ...payload,
        id: nanoid(),
        history: [{ stage: payload.stage, date: new Date().toISOString() }],
      }
      persist({ ...snapshot, opportunities: [opportunity, ...snapshot.opportunities] })
      return opportunity
    },
    update: (id: string, patch: Partial<Opportunity>) => {
      persist({
        ...snapshot,
        opportunities: snapshot.opportunities.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      })
      return snapshot.opportunities.find((o) => o.id === id)
    },
    delete: (id: string) => {
      persist({
        ...snapshot,
        opportunities: snapshot.opportunities.filter((o) => o.id !== id),
      })
    },
  },
  tickets: {
    addMessage: (id: string, message: Ticket['thread'][number]) => {
      persist({
        ...snapshot,
        tickets: snapshot.tickets.map((t) =>
          t.id === id ? { ...t, thread: [...t.thread, { ...message, id: nanoid() }] } : t
        ),
      })
      return snapshot.tickets.find((t) => t.id === id)
    },
    update: (id: string, patch: Partial<Ticket>) => {
      persist({
        ...snapshot,
        tickets: snapshot.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })
      return snapshot.tickets.find((t) => t.id === id)
    },
  },
  invoices: {
    addPayment: (id: string, payment: Invoice['payments'][number]) => {
      persist({
        ...snapshot,
        invoices: snapshot.invoices.map((inv) =>
          inv.id === id ? { ...inv, payments: [...inv.payments, payment] } : inv
        ),
      })
      return snapshot.invoices.find((inv) => inv.id === id)
    },
    updateStatus: (id: string, status: Invoice['status']) => {
      persist({
        ...snapshot,
        invoices: snapshot.invoices.map((inv) => (inv.id === id ? { ...inv, status } : inv)),
      })
      return snapshot.invoices.find((inv) => inv.id === id)
    },
  },
  inventory: {
    adjust: (sku: string, delta: number) => {
      persist({
        ...snapshot,
        products: snapshot.products.map((p) => (p.sku === sku ? { ...p, stock: Math.max(0, p.stock + delta) } : p)),
      })
      return snapshot.products.find((p) => p.sku === sku)
    },
    upsertProduct: (product: Partial<Product> & { sku: string }) => {
      const exists = snapshot.products.find((p) => p.sku === product.sku)
      const updated = exists ? { ...exists, ...product } : { id: nanoid(), ...product } as Product
      const products = exists
        ? snapshot.products.map((p) => (p.sku === product.sku ? updated : p))
        : [updated, ...snapshot.products]
      persist({ ...snapshot, products })
      return updated
    },
  },
  salesOrders: {
    updateStatus: (id: string, status: SalesOrder['status']) => {
      persist({
        ...snapshot,
        salesOrders: snapshot.salesOrders.map((so) => (so.id === id ? { ...so, status } : so)),
      })
      return snapshot.salesOrders.find((so) => so.id === id)
    },
  },
  purchaseOrders: {
    updateStatus: (id: string, status: PurchaseOrder['status']) => {
      persist({
        ...snapshot,
        purchaseOrders: snapshot.purchaseOrders.map((po) => (po.id === id ? { ...po, status } : po)),
      })
      return snapshot.purchaseOrders.find((po) => po.id === id)
    },
  },
  tasks: {
    create: (payload: Omit<Task, 'id'>) => {
      const task: Task = { ...payload, id: nanoid() }
      persist({ ...snapshot, tasks: [task, ...snapshot.tasks] })
      return task
    },
    update: (id: string, patch: Partial<Task>) => {
      persist({
        ...snapshot,
        tasks: snapshot.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })
      return snapshot.tasks.find((t) => t.id === id)
    },
    delete: (id: string) => {
      persist({ ...snapshot, tasks: snapshot.tasks.filter((t) => t.id !== id) })
    },
  },
  exportCsv: (rows: Record<string, unknown>[]) => {
    const headers = Object.keys(rows[0] ?? {})
    const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(','))].join('\n')
    return csv
  },
  snapshot: () => clone(snapshot),
}

