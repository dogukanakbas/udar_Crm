export type Role = 'Admin' | 'Manager' | 'Sales' | 'Finance' | 'Support' | 'Warehouse' | 'Worker'

export type LeadStatus = 'New' | 'Qualified' | 'Contacted' | 'Nurturing' | 'Proposal' | 'Closed Won' | 'Closed Lost'

export type OpportunityStage = 'Qualification' | 'Discovery' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost'

export type TicketStatus = 'Open' | 'In Progress' | 'Waiting' | 'Resolved' | 'Closed'
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent'

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue'
export type SalesOrderStatus = 'Draft' | 'Confirmed' | 'Packing' | 'Shipped' | 'Delivered' | 'Cancelled'
export type PurchaseStatus = 'Draft' | 'Ordered' | 'Receiving' | 'Closed'
export type QuoteStatus = 'Draft' | 'Sent' | 'Under Review' | 'Approved' | 'Rejected' | 'Converted'

export interface TimelineItem {
  id: string
  type: 'note' | 'email' | 'call' | 'meeting'
  author: string
  summary: string
  date: string
}

export interface Lead {
  id: string
  name: string
  title: string
  companyId: string
  email: string
  phone: string
  owner: string
  status: LeadStatus
  source: string
  score: number
  createdAt: string
  tags: string[]
  timeline: TimelineItem[]
}

export interface Opportunity {
  id: string
  name: string
  leadId: string
  companyId: string
  owner: string
  stage: OpportunityStage
  value: number
  probability: number
  closeDate: string
  products: { sku: string; name: string; qty: number; price: number; discount?: number }[]
  history: { stage: OpportunityStage; date: string }[]
}

export interface Company {
  id: string
  name: string
  industry: string
  region: string
  size: string
  owner: string
  rating: number
  currency: string
  annualRevenue: number
}

export interface Contact {
  id: string
  companyId: string
  name: string
  role: string
  email: string
  phone: string
  owner: string
}

export interface SalesOrder {
  id: string
  number: string
  customerId: string
  status: SalesOrderStatus
  amount: number
  shippingDate: string
  expectedDelivery: string
  items: { sku: string; name: string; qty: number; price: number }[]
}

export interface PurchaseOrder {
  id: string
  number: string
  supplier: string
  status: PurchaseStatus
  amount: number
  expectedDate: string
  items: { sku: string; name: string; qty: number; cost: number }[]
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  stock: number
  reserved: number
  reorderPoint: number
  warehouse: string
  price: number
}

export interface InvoicePayment {
  date: string
  amount: number
  method: string
}

export interface Invoice {
  id: string
  number: string
  status: InvoiceStatus
  companyId: string
  currency: string
  amount: number
  dueDate: string
  issuedAt: string
  payments: InvoicePayment[]
}

export interface TicketMessage {
  id: string
  author: string
  message: string
  time: string
  internal?: boolean
}

export interface Ticket {
  id: string
  subject: string
  companyId: string
  contactId?: string
  status: TicketStatus
  priority: TicketPriority
  assignee: string
  sla: string
  updatedAt: string
  thread: TicketMessage[]
}

export interface Task {
  id: string
  title: string
  due?: string
  owner: string
  status: 'todo' | 'in-progress' | 'done'
  assignee?: string
  teamId?: string
  start?: string
  end?: string
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]
  plannedHours?: number
  plannedCost?: number
  attachments?: Attachment[]
  comments?: TaskComment[]
  checklist?: TaskChecklistItem[]
  time_entries?: TaskTimeEntry[]
  history?: TaskHistoryItem[]
  notes?: string
}

export interface Team {
  id: string
  name: string
  memberIds: string[]
}

export interface UserLite {
  id: string
  username: string
  email: string
  role: string
}

export interface Attachment {
  id: string
  file: string
  description?: string
  fileName?: string
  contentType?: string
  size?: number
  version?: number
  parent?: string
  uploadedBy?: string
  uploadedAt?: string
  tags?: string[]
}

export interface TaskComment {
  id: string
  text: string
  type: 'comment' | 'activity'
  createdAt?: string
  author?: string
  authorName?: string
  task?: string
}

export interface TaskHistoryItem {
  id: string
  text: string
  actor?: string
  at?: string
}

export interface TaskChecklistItem {
  id: string
  title: string
  done: boolean
  order?: number
  createdAt?: string
}

export interface AutomationRule {
  id: string
  name: string
  trigger: 'task_status_changed' | 'task_due_soon'
  condition: Record<string, any>
  action: 'add_comment' | 'set_assignee' | 'notify'
  action_payload: Record<string, any>
  is_active: boolean
  created_at?: string
}

export interface TaskTimeEntry {
  id: string
  task: string
  user?: string
  user_name?: string
  started_at: string
  ended_at?: string
  note?: string
  created_at?: string
}

export interface QuoteLine {
  sku: string
  name: string
  qty: number
  unitPrice: number
  discount?: number
  tax?: number
  category?: string
}

export interface QuoteApprovalStep {
  role: 'Sales' | 'Manager' | 'Finance'
  status: 'Waiting' | 'Approved' | 'Rejected'
  comment?: string
  updatedAt?: string
}

export interface QuoteHistoryItem {
  id: string
  field: string
  oldValue?: string
  newValue?: string
  user: string
  time: string
}

export interface Quote {
  id: string
  number: string
  customerId: string
  opportunityId?: string
  leadId?: string
  owner: string
  status: QuoteStatus
  validUntil: string
  total: number
  subtotal: number
  discountTotal: number
  taxTotal: number
  currency: string
  createdAt: string
  updatedAt: string
  lines: QuoteLine[]
  approval: QuoteApprovalStep[]
  history: QuoteHistoryItem[]
  terms: {
    payment: string
    delivery: string
    notes?: string
  }
}

export interface PricingRule {
  id: string
  name: string
  type: 'customer' | 'category' | 'volume'
  target: string
  value: number
  description: string
}

export interface Vehicle {
  id: string
  name: string
  plate: string
  driver: string
  status: 'Yolda' | 'Yükleniyor' | 'Teslimatta' | 'Mola' | 'Tamamlandı'
  lastUpdate: string
  location: { lat: number; lng: number; city: string }
  distanceToday: number
  avgSpeed: number
  idleMinutes: number
  stops: number
  eta: string
  temperature?: number
}

export interface TodayPanel {
  tasks: Task[]
  meetings: { id: string; subject: string; time: string; owner: string }[]
  overdueInvoices: string[]
  lowStockSkus: string[]
}

export interface MockDbSnapshot {
  version: number
  leads: Lead[]
  opportunities: Opportunity[]
  companies: Company[]
  contacts: Contact[]
  products: Product[]
  salesOrders: SalesOrder[]
  purchaseOrders: PurchaseOrder[]
  invoices: Invoice[]
  tickets: Ticket[]
  quotes: Quote[]
  pricingRules: PricingRule[]
  quoteHistory: QuoteHistoryItem[]
  vehicles: Vehicle[]
  tasks: Task[]
  teams: Team[]
  users: UserLite[]
  rolePermissions?: string[]
  today: TodayPanel
  savedViews: Record<string, { name: string; filters: Record<string, string> }[]>
  settings: {
    role: Role
    locale: 'en-US' | 'tr-TR'
    demoWatermark: boolean
    notifications: {
      email: boolean
      desktop: boolean
      slack: boolean
    }
  }
}

