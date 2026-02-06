import { nanoid } from 'nanoid'

import {
  type Company,
  type Contact,
  type Invoice,
  type Lead,
  type MockDbSnapshot,
  type Opportunity,
  type Product,
  type PurchaseOrder,
  type SalesOrder,
  type Task,
  type Ticket,
  type TodayPanel,
  type Vehicle,
  type Quote,
  type PricingRule,
  type QuoteHistoryItem,
} from '@/types'

const owners = ['Ece Kaya', 'Arda Yilmaz', 'Deniz Demir', 'Mert Korkmaz', 'Selin Acar', 'Lara Soylu']
const industries = ['SaaS', 'Logistics', 'Manufacturing', 'E-commerce', 'Healthcare', 'Fintech']
const regions = ['Istanbul', 'Ankara', 'Izmir', 'Berlin', 'London', 'Dubai']
const leadSources = ['Website', 'Referral', 'Event', 'Outbound', 'Partner', 'LinkedIn']
const leadStatuses: Lead['status'][] = ['New', 'Qualified', 'Contacted', 'Nurturing', 'Proposal', 'Closed Won', 'Closed Lost']
const oppStages: Opportunity['stage'][] = ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
const productsCatalog = [
  { name: 'OmniCRM Seat', category: 'Software', price: 1200 },
  { name: 'OmniERP Seat', category: 'Software', price: 1800 },
  { name: 'Field Tablet', category: 'Hardware', price: 650 },
  { name: 'Smart Scanner', category: 'Hardware', price: 420 },
  { name: 'Voice Bot Add-on', category: 'Add-on', price: 240 },
  { name: 'Analytics Pro', category: 'Add-on', price: 360 },
]

const random = (max: number) => Math.floor(Math.random() * max)

const makeCompanies = (): Company[] =>
  Array.from({ length: 30 }, (_, i) => ({
    id: `cmp-${i + 1}`,
    name: `Company ${i + 1}`,
    industry: industries[i % industries.length],
    region: regions[i % regions.length],
    size: i % 3 === 0 ? 'Enterprise' : i % 3 === 1 ? 'Mid-Market' : 'SMB',
    owner: owners[i % owners.length],
    rating: 3 + (i % 3),
    currency: i % 5 === 0 ? 'EUR' : 'USD',
    annualRevenue: 1_000_000 + i * 35_000,
  }))

const makeContacts = (companies: Company[]): Contact[] =>
  companies.flatMap((company, idx) =>
    Array.from({ length: 2 }, (_, j) => ({
      id: `cnt-${idx + 1}-${j + 1}`,
      companyId: company.id,
      name: `${company.name} Contact ${j + 1}`,
      role: j % 2 === 0 ? 'Operations Manager' : 'Procurement Lead',
      email: `contact${idx + 1}${j + 1}@example.com`,
      phone: `+90 555 00${idx}${j}`,
      owner: owners[(idx + j) % owners.length],
    }))
  )

const makeLeads = (companies: Company[]): Lead[] =>
  Array.from({ length: 50 }, (_, i) => {
    const company = companies[i % companies.length]
    const status = leadStatuses[i % leadStatuses.length]
    return {
      id: `lead-${i + 1}`,
      name: `Lead ${i + 1}`,
      title: i % 2 === 0 ? 'Head of Ops' : 'IT Manager',
      companyId: company.id,
      email: `lead${i + 1}@${company.name.toLowerCase().replace(/\s/g, '')}.com`,
      phone: `+90 532 ${String(1000 + i).slice(-4)}`,
      owner: owners[i % owners.length],
      status,
      source: leadSources[i % leadSources.length],
      score: 55 + (i % 40),
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      tags: ['priority', status === 'Closed Won' ? 'customer' : 'prospect'].slice(0, status === 'Closed Lost' ? 1 : 2),
      timeline: [
        {
          id: nanoid(),
          type: 'note',
          author: owners[i % owners.length],
          summary: 'Initial discovery and qualification call completed.',
          date: new Date(Date.now() - i * 86400000).toISOString(),
        },
        {
          id: nanoid(),
          type: 'email',
          author: 'System',
          summary: 'Shared proposal deck with pricing options.',
          date: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
        },
      ],
    }
  })

const makeOpportunities = (leads: Lead[]): Opportunity[] =>
  Array.from({ length: 25 }, (_, i) => {
    const lead = leads[i * 2]
    return {
      id: `opp-${i + 1}`,
      name: `${lead.companyId} Expansion`,
      leadId: lead.id,
      companyId: lead.companyId,
      owner: lead.owner,
      stage: oppStages[i % oppStages.length],
      value: 20000 + i * 3000,
      probability: 35 + (i % 50),
      closeDate: new Date(Date.now() + (15 + i) * 86400000).toISOString(),
      products: [
        {
          sku: `SKU-${100 + i}`,
          name: productsCatalog[i % productsCatalog.length].name,
          qty: 5 + (i % 3),
          price: productsCatalog[i % productsCatalog.length].price,
          discount: i % 3 === 0 ? 8 : 0,
        },
      ],
      history: [
        { stage: 'Qualification', date: new Date(Date.now() - 10 * 86400000).toISOString() },
        { stage: 'Discovery', date: new Date(Date.now() - 7 * 86400000).toISOString() },
      ],
    }
  })

const makeProducts = (): Product[] =>
  Array.from({ length: 100 }, (_, i) => {
    const catalogItem = productsCatalog[i % productsCatalog.length]
    return {
      id: `prd-${i + 1}`,
      sku: `SKU-${1000 + i}`,
      name: `${catalogItem.name} ${i % 4 === 0 ? 'Plus' : ''}`.trim(),
      category: catalogItem.category,
      stock: 20 + random(80),
      reserved: 5 + random(10),
      reorderPoint: 15,
      warehouse: ['Istanbul WH1', 'Berlin Hub', 'Izmir Port'][i % 3],
      price: catalogItem.price + (i % 4) * 25,
    }
  })

const makeSalesOrders = (companies: Company[], products: Product[]): SalesOrder[] =>
  Array.from({ length: 20 }, (_, i) => ({
    id: `so-${i + 1}`,
    number: `SO-${2024 + i}`,
    customerId: companies[i % companies.length].id,
    status: (['Draft', 'Confirmed', 'Packing', 'Shipped', 'Delivered'] as SalesOrder['status'][])[i % 5],
    amount: 2500 + i * 500,
    shippingDate: new Date(Date.now() - (i - 2) * 86400000).toISOString(),
    expectedDelivery: new Date(Date.now() + (3 + i) * 86400000).toISOString(),
    items: [
      {
        sku: products[i % products.length].sku,
        name: products[i % products.length].name,
        qty: 2 + (i % 3),
        price: products[i % products.length].price,
      },
    ],
  }))

const makePurchaseOrders = (products: Product[]): PurchaseOrder[] =>
  Array.from({ length: 12 }, (_, i) => ({
    id: `po-${i + 1}`,
    number: `PO-${500 + i}`,
    supplier: ['Globex', 'Innotech', 'Northwind'][i % 3],
    status: (['Draft', 'Ordered', 'Receiving', 'Closed'] as PurchaseOrder['status'][])[i % 4],
    amount: 4000 + i * 700,
    expectedDate: new Date(Date.now() + (7 + i) * 86400000).toISOString(),
    items: [
      {
        sku: products[i % products.length].sku,
        name: products[i % products.length].name,
        qty: 5 + (i % 4),
        cost: 120 + i * 5,
      },
    ],
  }))

const makeInvoices = (companies: Company[]): Invoice[] =>
  Array.from({ length: 40 }, (_, i) => ({
    id: `inv-${i + 1}`,
    number: `INV-${1300 + i}`,
    status: (['Draft', 'Sent', 'Paid', 'Overdue'] as Invoice['status'][])[i % 4],
    companyId: companies[i % companies.length].id,
    currency: i % 5 === 0 ? 'EUR' : 'USD',
    amount: 1500 + i * 250,
    dueDate: new Date(Date.now() + (10 + i) * 86400000).toISOString(),
    issuedAt: new Date(Date.now() - i * 86400000).toISOString(),
    payments: i % 3 === 0 ? [{ date: new Date().toISOString(), amount: 500, method: 'Wire' }] : [],
  }))

const makeTickets = (companies: Company[]): Ticket[] =>
  Array.from({ length: 25 }, (_, i) => ({
    id: `tck-${i + 1}`,
    subject: `Support ticket ${i + 1}`,
    companyId: companies[i % companies.length].id,
    status: (['Open', 'In Progress', 'Waiting', 'Resolved', 'Closed'] as Ticket['status'][])[i % 5],
    priority: (['Low', 'Medium', 'High', 'Urgent'] as Ticket['priority'][])[i % 4],
    assignee: owners[i % owners.length],
    sla: i % 2 === 0 ? '8h' : '4h',
    updatedAt: new Date(Date.now() - i * 3600000).toISOString(),
    thread: [
      {
        id: nanoid(),
        author: owners[(i + 1) % owners.length],
        message: 'Investigating the root cause and collecting logs.',
        time: new Date(Date.now() - i * 3600000).toISOString(),
        internal: i % 3 === 0,
      },
      {
        id: nanoid(),
        author: 'Customer',
        message: 'Experiencing delayed sync on mobile devices.',
        time: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
      },
    ],
  }))

const makeTodayPanel = (invoices: Invoice[], products: Product[]): TodayPanel => {
  const tasks: Task[] = [
    {
      id: 'task-1',
      title: 'Pipeline hesaplarını ara',
      due: new Date().toISOString(),
      owner: owners[0],
      status: 'in-progress',
      assignee: owners[0],
      priority: 'high',
    },
    {
      id: 'task-2',
      title: 'Geciken faturaları kontrol et',
      due: new Date().toISOString(),
      owner: owners[1],
      status: 'todo',
      assignee: owners[1],
      priority: 'medium',
    },
    {
      id: 'task-3',
      title: 'QBR sunumunu hazırla',
      due: new Date().toISOString(),
      owner: owners[2],
      status: 'todo',
      assignee: owners[2],
      priority: 'medium',
    },
  ]
  const meetings = [
    { id: 'mtg-1', subject: 'Discovery with ACME', time: '10:00', owner: owners[0] },
    { id: 'mtg-2', subject: 'Renewal with Northwind', time: '14:30', owner: owners[1] },
  ]
  const overdueInvoices = invoices.filter((inv) => inv.status === 'Overdue').slice(0, 5).map((inv) => inv.number)
  const lowStockSkus = products.filter((p) => p.stock - p.reserved < p.reorderPoint).slice(0, 5).map((p) => p.sku)
  return { tasks, meetings, overdueInvoices, lowStockSkus }
}

const makeVehicles = (): Vehicle[] => {
  const cities = ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Edirne', 'Eskişehir']
  return Array.from({ length: 8 }, (_, i) => ({
    id: `vh-${i + 1}`,
    name: `Araç ${i + 1}`,
    plate: `34 ABC ${120 + i}`,
    driver: owners[i % owners.length],
    status: (['Yolda', 'Teslimatta', 'Mola', 'Yükleniyor'] as Vehicle['status'][])[i % 4],
    lastUpdate: new Date(Date.now() - i * 120000).toISOString(),
    location: { lat: 41 + i * 0.02, lng: 29 + i * 0.01, city: cities[i % cities.length] },
    distanceToday: 80 + i * 12,
    avgSpeed: 62 + i,
    idleMinutes: 10 + i * 2,
    stops: 2 + (i % 3),
    eta: new Date(Date.now() + (90 + i * 10) * 60000).toISOString(),
    temperature: 5 + i,
  }))
}

const makeTasks = (): Task[] =>
  Array.from({ length: 12 }, (_, i) => ({
    id: `tsk-${i + 1}`,
    title: ['Teslimat planı', 'Araç bakım kontrolü', 'Depo sayımı', 'SLA raporu'][i % 4] + ` #${i + 1}`,
    due: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
    owner: owners[i % owners.length],
    assignee: owners[(i + 2) % owners.length],
    start: new Date(Date.now() - (i % 3) * 86400000).toISOString(),
    end: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
    status: (['todo', 'in-progress', 'done'] as Task['status'][])[i % 3],
    priority: (['low', 'medium', 'high'] as Task['priority'][])[i % 3],
    tags: ['lojistik', 'satış', 'destek'].slice(0, (i % 3) + 1),
  }))

const makePricingRules = (): PricingRule[] => [
  { id: 'pr-1', name: 'VIP müşteri indirimi', type: 'customer', target: 'Enterprise', value: 8, description: 'VIP müşteriler için %8 indirim' },
  { id: 'pr-2', name: 'Donanım kategorisi', type: 'category', target: 'Hardware', value: 5, description: 'Donanım ürünlerinde %5 indirim' },
  { id: 'pr-3', name: '50k üzeri hacim', type: 'volume', target: '50000', value: 3, description: '50k üstü siparişlerde %3' },
]

const makeQuotes = (companies: Company[], products: Product[]): Quote[] => {
  const statuses: Quote['status'][] = ['Draft', 'Sent', 'Under Review', 'Approved', 'Rejected', 'Converted']
  return Array.from({ length: 15 }, (_, i) => {
    const company = companies[i % companies.length]
    const lines: Quote['lines'] = [
      {
        sku: products[i % products.length].sku,
        name: products[i % products.length].name,
        qty: 2 + (i % 3),
        unitPrice: products[i % products.length].price,
        discount: i % 3 === 0 ? 5 : 0,
        tax: 18,
        category: products[i % products.length].category,
      },
      {
        sku: products[(i + 1) % products.length].sku,
        name: products[(i + 1) % products.length].name,
        qty: 1 + (i % 2),
        unitPrice: products[(i + 1) % products.length].price,
        discount: 0,
        tax: 18,
        category: products[(i + 1) % products.length].category,
      },
    ]
    const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
    const discountTotal = lines.reduce((s, l) => s + (l.discount ?? 0) / 100 * l.qty * l.unitPrice, 0) + (i % 4 === 0 ? 500 : 0)
    const taxTotal = (subtotal - discountTotal) * 0.18
    const total = subtotal - discountTotal + taxTotal
    const approval: Quote['approval'] = [
      { role: 'Sales', status: i % 2 === 0 ? 'Approved' : 'Waiting', updatedAt: new Date().toISOString() },
      { role: 'Manager', status: i % 3 === 0 ? 'Approved' : 'Waiting' },
      { role: 'Finance', status: 'Waiting' },
    ]
    const history: QuoteHistoryItem[] = [
      { id: nanoid(), field: 'status', oldValue: 'Draft', newValue: statuses[i % statuses.length], user: 'System', time: new Date().toISOString() },
    ]
    return {
      id: `q-${i + 1}`,
      number: `Q-${20250 + i}`,
      customerId: company.id,
      owner: owners[i % owners.length],
      status: statuses[i % statuses.length],
      validUntil: new Date(Date.now() + (15 + i) * 86400000).toISOString(),
      total,
      subtotal,
      discountTotal,
      taxTotal,
      currency: 'USD',
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - i * 43200000).toISOString(),
      lines,
      approval,
      history,
      terms: {
        payment: 'Net 30',
        delivery: 'CIF',
        notes: 'Bu bir demo teklifidir.',
      },
    }
  })
}

const makeQuoteHistory = (quotes: Quote[]): QuoteHistoryItem[] =>
  quotes.flatMap((q) => [
    ...q.history,
    { id: nanoid(), field: 'owner', oldValue: q.owner, newValue: owners[(owners.indexOf(q.owner) + 1) % owners.length], user: 'Admin', time: q.updatedAt },
  ])

export const buildSeed = (): MockDbSnapshot => {
  const companies = makeCompanies()
  const contacts = makeContacts(companies)
  const leads = makeLeads(companies)
  const opportunities = makeOpportunities(leads)
  const products = makeProducts()
  const salesOrders = makeSalesOrders(companies, products)
  const purchaseOrders = makePurchaseOrders(products)
  const invoices = makeInvoices(companies)
  const tickets = makeTickets(companies)
  const today = makeTodayPanel(invoices, products)
  const vehicles = makeVehicles()
  const tasks = makeTasks()
  const pricingRules = makePricingRules()
  const quotes = makeQuotes(companies, products)
  const quoteHistory = makeQuoteHistory(quotes)

  return {
    version: 1,
    companies,
    contacts,
    leads,
    opportunities,
    products,
    salesOrders,
    purchaseOrders,
    invoices,
    tickets,
    quotes,
    pricingRules,
    quoteHistory,
    vehicles,
    tasks,
    teams: [],
    users: [],
    rolePermissions: [],
    today,
    savedViews: {
      leads: [
        { name: 'Sıcak Adaylar', filters: { status: 'Qualified', score: '70' } },
        { name: 'Son 30g Kazanılan', filters: { status: 'Closed Won' } },
      ],
      opportunities: [{ name: 'Bu Çeyrek', filters: { stage: 'Negotiation' } }],
      inventory: [{ name: 'Düşük Stok', filters: { alert: 'low' } }],
    },
    settings: {
      role: 'Manager',
      locale: 'tr-TR',
      demoWatermark: true,
      notifications: {
        email: true,
        desktop: true,
        slack: false,
      },
    },
  }
}

