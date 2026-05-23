export type Role = 'Admin' | 'Manager' | 'Sales' | 'Finance' | 'Support' | 'Warehouse' | 'Worker'

export type LeadStatus = 'New' | 'Qualified' | 'Contacted' | 'Nurturing' | 'Proposal' | 'Closed Won' | 'Closed Lost'

export type OpportunityStage = 'Qualification' | 'Discovery' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost'

export type TicketStatus = 'Open' | 'In Progress' | 'Waiting' | 'Resolved' | 'Closed'
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent'

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue'
export type SalesOrderStatus = 'Draft' | 'Confirmed' | 'Packing' | 'Shipped' | 'Delivered' | 'Cancelled'
export type PurchaseStatus = 'Draft' | 'Ordered' | 'Receiving' | 'Closed'
export type QuoteStatus = 'Draft' | 'Sent' | 'Under Review' | 'Approved' | 'Rejected' | 'Converted'
export type SalesDocumentType = 'Quote' | 'Contract'

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
  country?: string
  size: string
  owner: string
  rating: number
  currency: string
  priceListKey?: string
  annualRevenue: number
  address?: string
  taxOffice?: string
  taxNumber?: string
  authorizedPerson?: string
  phone?: string
  email?: string
}

export interface CategoryTemplateField {
  field_key: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea'
  options?: string[]
  required?: boolean
  order?: number
  applies_to_documents?: 'quote' | 'contract' | 'both'
}

export interface Category {
  id: string
  name: string
  templateDefaults?: Record<string, any>
  attributeSchema?: CategoryTemplateField[]
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
  /** Sipariş adedi — üretim girişleri quantity_produced günceller */
  orderQuantity?: number
  quantityProduced?: number
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
  categoryId?: string
  categoryName?: string
  stock: number
  reserved: number
  reorderPoint: number
  warehouse: string
  price: number
  priceLists?: Record<string, number | string>
  templateFamily?: string
  templateDefaults?: Record<string, any>
  categoryTemplateDefaults?: Record<string, any>
  categoryAttributeSchema?: CategoryTemplateField[]
  resolvedAttributeSchema?: CategoryTemplateField[]
  attributeValues?: Record<string, any>
  attributeSchemaOverride?: CategoryTemplateField[]
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

/** Tek görev içindeki bir ürün kalemi (çoklu ürün üretimi). */
export interface TaskProductLine {
  mode?: 'manual' | 'fixed'
  unitType?: 'adet' | 'metre'
  modelCode?: string
  variant?: string
  quantity?: number
  modelDurationMinutes?: number
  totalPlannedMinutes?: number
  modelBladeDepth?: string
  modelSizes?: string[]
  productColor?: string
  productColorCode?: string
  /** Ürün kalemi için kısa tanıtım (ayrıntı kartında) */
  briefIntro?: string
  /** Fire adedi (kalem bazında) */
  fireQty?: number
  /** Fire sebebi */
  fireReason?: string
  /** Yerel/opsiyonel fire görseli */
  fireImageDataUrl?: string
  /** Bu kalem için raporlanan toplam üretim adedi (sunucu: qty_produced) */
  qtyProduced?: number
  /** Kalem bazlı ekip sırası */
  workflowTeamIds?: string[]
  /** Kalem bazlı hedef adetler */
  workflowStageTargets?: number[]
  /** Kalem bazlı aşama durumu */
  workflowStageState?: Record<
    string,
    {
      assignee_id?: number | null
      qty_target?: number
      qty_done?: number
      pending_approval?: boolean
      stage_done?: boolean
    }
  >
  /** Kalemde şu an açık ekip */
  currentTeamId?: string | null
}

export interface Task {
  id: string
  title: string
  due?: string
  owner: string
  status: 'todo' | 'in-progress' | 'done'
  assignee?: string
  teamId?: string
  currentTeam?: string
  workflowTeamIds?: string[]  // Sıralı ekip ID listesi: 1. ekip bitirince 2'ye, son ekip bitirince done
  workflowParallel?: boolean
  workflowStageTargets?: number[]
  workflowStageState?: Record<
    string,
    {
      assignee_id?: number | null
      qty_target?: number
      qty_done?: number
      /** Çoklu ürün: kalem indeksi -> o ekipte bildirilen mutlak üretim */
      qty_done_by_line?: Record<string, number>
      pending_approval?: boolean
      stage_done?: boolean
      /** Hedefin altında onaya gönderilirken yazılan gerekçe (API: production_shortfall_reason) */
      production_shortfall_reason?: string
    }
  >
  salesOrder?: string
  mode?: 'manual' | 'fixed'
  modelCode?: string
  variant?: string
  quantity?: number
  modelDurationMinutes?: number
  totalPlannedMinutes?: number
  modelBladeDepth?: string
  modelSizes?: string[]
  productColor?: string
  productColorCode?: string
  start?: string
  end?: string
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]
  plannedHours?: number
  plannedCost?: number
  handoverReason?: string
  handoverAt?: string
  handoverHistory?: any[]
  attachments?: Attachment[]
  comments?: TaskComment[]
  checklist?: TaskChecklistItem[]
  time_entries?: TaskTimeEntry[]
  history?: TaskHistoryItem[]
  notes?: string
  productionEntries?: TaskProductionEntry[]
  mdfConsumptions?: TaskMdfConsumption[]
  /** Birden fazla ürün; aktif olanın alanları modelCode / quantity vb. ile senkron tutulur. */
  productLines?: TaskProductLine[]
  activeProductIndex?: number
}

export interface TaskProductionEntry {
  id: string
  task: string
  user?: string
  userName?: string
  team?: string
  teamName?: string
  /** Çoklu ürün: kalem indeksi (yoksa eski kayıt) */
  productLineIndex?: number | null
  entryDate: string
  quantity: number
  note?: string
  createdAt?: string
}

export interface TaskMdfConsumption {
  id: string
  task: string
  user?: string
  userName?: string
  team?: string
  teamName?: string
  mdfSku?: string
  mdfLabel?: string
  quantity: number
  consumedAt: string
  note?: string
  createdAt?: string
}

export interface Team {
  id: string
  name: string
  memberIds: string[]
  /** Usta başı / ekip lideri kullanıcı id */
  leaderId?: string
}

export interface UserLite {
  id: string
  username: string
  email: string
  role: string
  firstName?: string
  lastName?: string
  fullName?: string
  permissions?: string[]
  canPrepareQuotes?: boolean
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
  /** Doluysa madde iş akışı ekip adımına bağlıdır; tik ve sıra sunucudan senkron olur. */
  workflowTeamId?: string
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
  team?: string
  section?: string
  started_at: string
  ended_at?: string
  note?: string
  created_at?: string
}

export interface QuoteLine {
  id?: string
  productId?: string
  sku: string
  name: string
  sectionKey?: string
  category?: string
  unit?: string
  qty: number
  unitPrice: number
  discount?: number
  discountSecondary?: number
  tax?: number
  details?: {
    code?: string
    primary?: string
    secondary?: string
    attributes?: Record<string, any>
  }
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
  documentType: SalesDocumentType
  number: string
  customerId: string
  customerName?: string
  opportunityId?: string
  leadId?: string
  owner: string
  preparedById?: string
  preparedByName?: string
  sellerCompanyKey?: string
  status: QuoteStatus
  validUntil: string
  total: number
  subtotal: number
  discountTotal: number
  taxTotal: number
  currency: string
  /** KDV oranı % (örn. 20, 10). Backend: vat_rate */
  vatRate?: number
  createdAt: string
  updatedAt: string
  lines: QuoteLine[]
  approval: QuoteApprovalStep[]
  history: QuoteHistoryItem[]
  contractConfig?: {
    templateSheet?: string
    template_sheet?: string
    validityLabel?: string
    validity_label?: string
    priceListLabel?: string
    price_list_label?: string
    priceListKey?: string
    price_list_key?: string
    deliveryType?: string
    delivery_type?: string
    paymentOption?: string
    payment_option?: string
    contractDate?: string
    contract_date?: string
    exchangeRate?: number
    exchange_rate?: number
    customerSnapshot?: Record<string, string>
    customer_snapshot?: Record<string, string>
    preparedBySnapshot?: Record<string, string>
    prepared_by_snapshot?: Record<string, string>
    signatureCustomerLabel?: string
    signature_customer_label?: string
    templateMode?: string
    template_mode?: string
    templateKey?: string
    template_key?: string
    termsText?: string
    terms_text?: string
    contractNotesText?: string
    contract_notes_text?: string
    contractNotes?: string[]
    contract_notes?: string[]
    generalTerms?: string[]
    general_terms?: string[]
  }
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

export interface SellerBankAccount {
  bank: string
  iban: string
  currency?: string
  iban2?: string
  currency2?: string
  branch?: string
  accountHolder?: string
}

export interface SellerCompanyProfile {
  key: string
  shortName: string
  displayName: string
  legalName?: string
  taxOffice?: string
  taxNumber?: string
  mersisNumber?: string
  tradeRegistryNumber?: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  website?: string
  kepAddress?: string
  logoUrl?: string
  signatureName?: string
  signatureTitle?: string
  signatureLabel?: string
  bankIbanLabel?: string
  bankIban2Label?: string
  notes?: string
  isActive?: boolean
  sortOrder?: number
  bankAccounts: SellerBankAccount[]
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
  sellerCompanies: SellerCompanyProfile[]
  contacts: Contact[]
  categories?: Category[]
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
