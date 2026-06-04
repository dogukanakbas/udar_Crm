import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  Activity,
  CalendarClock,
  BarChart3,
  Bell,
  Building2,
  FileText,
  FolderKanban,
  Gauge,
  Home,
  KeyRound,
  Menu,
  Monitor,
  Moon,
  Package,
  Search,
  Settings,
  Settings2,
  Shield,
  SunMedium,
  LogOut,
  Volume2,
  CheckCircle2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Role } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/components/theme-provider'
import { GlobalSearch } from '@/components/global-search'
import { useAppStore } from '@/state/use-app-store'
import { ROLE_LABEL_TR } from '@/lib/role-labels'
import { cn } from '@/lib/utils'
import { getTokens, clearTokens } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { resolveBrandingUrl } from '@/lib/branding'
import { api } from '@/lib/api'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumb?: React.ReactNode
}

export const PageHeader = ({ title, description, actions, breadcrumb }: PageHeaderProps) => (
  <div className="mb-6 rounded-lg border border-border/70 bg-card/85 p-4 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.55)] backdrop-blur md:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div className="min-w-0 space-y-1">
      {breadcrumb}
      <h1 className="text-2xl font-semibold tracking-normal text-foreground md:text-[1.7rem]">{title}</h1>
      {description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </div>
)

type NavChild = { key?: string; label: string; to: string; perm?: string; roles?: string[]; displayOrder?: number }
type NavItem = {
  key?: string
  label: string
  to?: string
  icon: React.ComponentType<any>
  roles?: string[]
  perm?: string
  displayOrder?: number
  children?: NavChild[]
}

const iconMap: Record<string, React.ComponentType<any>> = {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  FileText,
  FolderKanban,
  Gauge,
  Home,
  KeyRound,
  Monitor,
  Package,
  Settings,
  Settings2,
}

const fallbackNav: NavItem[] = [
  { key: 'dashboard', label: 'Kontrol Paneli', to: '/', icon: Home, perm: 'settings.view' },
  { key: 'worker_home', label: 'Görevlerim', to: '/', icon: Home, roles: ['Worker'] },
  { key: 'task_history', label: 'Geçmiş görevler', to: '/task-history', icon: CalendarClock, perm: 'tasks.view.own' },
  { key: 'change_password', label: 'Şifre değiştir', to: '/change-password', icon: KeyRound },
  {
    key: 'crm',
    label: 'CRM',
    icon: Gauge,
    children: [
      { key: 'opportunities', label: 'Fırsatlar', to: '/crm/opportunities', perm: 'opportunities.view' },
      { key: 'partners', label: 'Cari Kartı', to: '/crm/companies', perm: 'partners.view' },
      { key: 'contacts', label: 'Kişiler', to: '/crm/contacts', perm: 'contacts.view' },
      { key: 'quotes', label: 'Teklif & Sözleşmeler', to: '/crm/quotes', perm: 'quotes.view.own' },
      { key: 'seller_companies', label: 'Satıcı Firmalar', to: '/crm/seller-companies', perm: 'templates.seller_companies.edit' },
      { key: 'quote_templates', label: 'Şablon Yönetimi', to: '/crm/quote-templates', perm: 'templates.view' },
    ],
  },
  {
    key: 'erp',
    label: 'ERP',
    icon: Package,
    perm: 'erp.view',
    children: [
      { key: 'sales_orders', label: 'Satış Siparişleri', to: '/erp/sales-orders', perm: 'orders.view' },
      { key: 'purchases', label: 'Satınalma', to: '/erp/purchases', perm: 'orders.view' },
      { key: 'inventory', label: 'Stok', to: '/erp/inventory', perm: 'inventory.view' },
      { key: 'warehouse_management', label: 'Depo Yönetimi', to: '/erp/warehouse-management', perm: 'warehouses.manage' },
      { key: 'warehouse', label: 'Depo', to: '/erp/warehouse', perm: 'warehouse_stock.view' },
      { key: 'production', label: 'İmalat Yönetimi', to: '/erp/production', perm: 'production.view' },
      { key: 'production_orders', label: 'İş Emirleri', to: '/erp/production/orders', perm: 'production.work_orders.view' },
      { key: 'production_console', label: 'İstasyon Konsolu', to: '/erp/production/console', perm: 'production.station.operate' },
      { key: 'production_reports', label: 'İmalat Raporları', to: '/erp/production/reports', perm: 'production.reports.view' },
      { key: 'invoicing', label: 'Faturalama', to: '/erp/invoicing', perm: 'invoices.view' },
      { key: 'accounting', label: 'Muhasebe', to: '/erp/accounting', perm: 'accounting.view' },
      { key: 'logistics', label: 'Lojistik Takip', to: '/logistics/tracking', perm: 'logistics.view' },
      { key: 'mdf', label: 'MDF Yönetimi', to: '/mdf', perm: 'inventory.view' },
      { key: 'mdf_history', label: 'MDF Giriş / Çıkış', to: '/mdf/history', perm: 'inventory.view' },
    ],
  },
  {
    key: 'support',
    label: 'Destek',
    icon: HeadsetIcon,
    children: [{ key: 'tickets', label: 'Destek talepleri', to: '/support/tickets', perm: 'tickets.view' }],
  },
  { key: 'tasks', label: 'Görevler', to: '/tasks', icon: ClipboardCheckIcon, perm: 'tasks.view' },
  { key: 'worker_tracking', label: 'Çalışan Takibi', to: '/worker-tracking', icon: Activity, perm: 'worker_tracking.view' },
  { key: 'calendar', label: 'Takvim', to: '/calendar', icon: CalendarIconMini, perm: 'tasks.calendar.view' },
  { key: 'reports', label: 'Raporlar', to: '/reports', icon: BarChart3, perm: 'reports.view' },
  { key: 'settings', label: 'Ayarlar', to: '/settings', icon: Settings, perm: 'settings.view' },
]

type AddonNavRow = {
  id?: number
  key: string
  label: string
  parent?: string
  parent_key?: string
  route?: string
  icon?: string
  permission?: string
  required_permission?: string
  display_order?: number
  is_active?: boolean
  meta?: Record<string, any>
}

const mergeAddonNavigation = (rows: AddonNavRow[], useFallback = true) => {
  const merged: NavItem[] = useFallback ? fallbackNav.map((item) => ({
    ...item,
    children: item.children ? item.children.map((child) => ({ ...child })) : undefined,
  })) : []
  const findGroup = (key?: string, label?: string) => merged.find((item) => item.key === key || item.label === label)
  rows
    .slice()
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
    .forEach((row) => {
      if (row.is_active === false) return
      const Icon = iconMap[row.icon || ''] || FolderKanban
      const parentKey = row.parent || row.parent_key || ''
      const permission = row.permission || row.required_permission || undefined
      const roles = Array.isArray(row.meta?.roles) ? row.meta.roles : undefined
      if (!parentKey) {
        const existing = findGroup(row.key, row.label)
        if (existing) {
          existing.label = row.label
          existing.icon = Icon
          existing.perm = permission || existing.perm
          existing.roles = roles || existing.roles
          existing.displayOrder = row.display_order
          if (row.route) existing.to = row.route
        } else {
          merged.push({ key: row.key, label: row.label, to: row.route || undefined, icon: Icon, perm: permission, roles, displayOrder: row.display_order })
        }
        return
      }
      let parent = findGroup(parentKey)
      if (!parent) {
        parent = { key: parentKey, label: parentKey, icon: FolderKanban, children: [] }
        merged.push(parent)
      }
      parent.children = parent.children || []
      const existingChild = parent.children.find((child) => child.key === row.key || child.to === row.route)
      const child = { key: row.key, label: row.label, to: row.route || '#', perm: permission, roles, displayOrder: row.display_order }
      if (existingChild) {
        Object.assign(existingChild, child)
      } else {
        parent.children.push(child)
      }
      parent.children.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
    })
  return merged.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
}

const isNavItemVisible = (item: NavItem, role: string, permissions: string[]) => {
  if (item.roles && !item.roles.includes(role)) return false
  if (item.children) {
    return item.children.some((child) => isNavChildVisible(child, role, permissions))
  }
  return hasPermission(role, permissions, item.perm)
}

const isNavChildVisible = (child: NavChild, role: string, permissions: string[]) => {
  if (child.roles && !child.roles.includes(role)) return false
  return hasPermission(role, permissions, child.perm)
}

function HeadsetIcon(props: React.ComponentProps<'svg'>) {
  return <Activity {...props} />
}

function ClipboardCheckIcon(props: React.ComponentProps<'svg'>) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /><path d="M9 5h-2a2 2 0 0 0-2 2v0" /><path d="M15 2v4" /><path d="M9 2v4" /><path d="M9 2h6" /></svg>
}

function CalendarIconMini(props: React.ComponentProps<'svg'>) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}

function playManagerAlarm() {
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContextCtor()
    
    const playTone = (freq: number, startDelay: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      
      const startTime = ctx.currentTime + startDelay
      gain.gain.setValueAtTime(0.001, startTime)
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05)
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    playTone(660, 0, 0.15)
    playTone(880, 0.12, 0.25)
    
    window.setTimeout(() => ctx.close(), 1000)
  } catch (e) {
    // Browser might block audio context before first user interaction
  }
}

export function AppShell() {
  const { data, resetDemo, setRole } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [addonNavigation, setAddonNavigation] = useState<AddonNavRow[]>([])
  const [navigationDesigned, setNavigationDesigned] = useState(false)
  const routerState = useRouterState()
  const loggedIn = !!getTokens()
  const isPublic = !loggedIn

  const [unackedAlerts, setUnackedAlerts] = useState<any[]>([])
  const [ackingAlertId, setAckingAlertId] = useState<number | null>(null)
  const alertedIdsRef = useRef<number[]>([])

  const canViewAlerts = loggedIn && hasPermission(data.settings.role, data.rolePermissions || [], 'production.alerts.view')
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('current-user-id') : null

  useEffect(() => {
    if (!canViewAlerts) {
      setUnackedAlerts([])
      return
    }

    const fetchAlerts = async () => {
      try {
        const res = await api.get('/production/station-alerts/')
        const allAlerts = Array.isArray(res.data) ? res.data : (res.data?.results || [])
        // Filter alerts that require acknowledgment and have not been acknowledged by this user
        const active = allAlerts.filter((alert: any) => {
          if (!alert.requires_ack) return false
          const hasAcked = alert.acks?.some((ack: any) => String(ack.user) === String(currentUserId))
          return !hasAcked
        })
        setUnackedAlerts(active)
      } catch (error) {
        console.error('Failed to fetch station alerts:', error)
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5000)
    return () => clearInterval(interval)
  }, [canViewAlerts, currentUserId])

  useEffect(() => {
    if (unackedAlerts.length > 0) {
      const newAlerts = unackedAlerts.filter(a => !alertedIdsRef.current.includes(a.id))
      if (newAlerts.length > 0) {
        playManagerAlarm()
        alertedIdsRef.current = [...alertedIdsRef.current, ...newAlerts.map(a => a.id)]
      }
    }
  }, [unackedAlerts])

  const ackAlert = async (alertId: number) => {
    setAckingAlertId(alertId)
    try {
      await api.post(`/production/station-alerts/${alertId}/ack/`, {})
      setUnackedAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    } finally {
      setAckingAlertId(null)
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    api.get('/addons/navigation/', { suppressAuthToast: true } as any)
      .then((res) => {
        setAddonNavigation(Array.isArray(res.data?.navigation) ? res.data.navigation : [])
        setNavigationDesigned(!!res.data?.designed)
      })
      .catch(() => {
        setAddonNavigation([])
        setNavigationDesigned(false)
      })
  }, [loggedIn, data.rolePermissions])

  const nav = useMemo(() => mergeAddonNavigation(addonNavigation, !navigationDesigned), [addonNavigation, navigationDesigned])

  const activePath = routerState.location.pathname
  const isQuotesWorkspace = activePath.startsWith('/crm/quotes')
  const isSellerCompanyWorkspace = activePath.startsWith('/crm/seller-companies')
  const isQuoteTemplateWorkspace = activePath.startsWith('/crm/quote-templates')
  const isInventoryWorkspace = activePath.startsWith('/erp/inventory')
  const isWarehouseWorkspace = activePath.startsWith('/erp/warehouse')
  const isProductionWorkspace = activePath.startsWith('/erp/production')
  const isWideWorkspace = isQuotesWorkspace || isSellerCompanyWorkspace || isQuoteTemplateWorkspace || isInventoryWorkspace || isWarehouseWorkspace || isProductionWorkspace

  useEffect(() => {
    const faviconUrl = resolveBrandingUrl(data.organization?.favicon_url, 'favicon')
    if (!faviconUrl) return
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (link) link.href = faviconUrl
  }, [data.organization?.favicon_url])

  if (activePath.startsWith('/erp/production/tablet')) {
    return <Outlet />
  }

  if (isPublic) {
    if (activePath.startsWith('/login')) {
      return <Outlet />
    }
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-[560px] p-6">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.12),transparent_30rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.38))]">
      <div className="flex min-h-screen w-full">
        {loggedIn && (
          <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 flex-col border-r border-white/10 bg-[#102d29] p-4 text-white lg:flex">
          <div className="mb-4 flex shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-3">
            <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/95 p-2 font-semibold shadow-[0_16px_38px_-22px_rgba(0,0,0,0.8)]">
              {data.organization?.logo_url ? (
                <img src={resolveBrandingUrl(data.organization.logo_url, 'logo')} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#173f38] font-bold shadow-[0_16px_38px_-22px_rgba(0,0,0,0.8)]">
                  {(data.organization?.brand_name || data.organization?.name || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45 truncate">
                {data.organization?.brand_name || data.organization?.name || 'Udar'}
              </p>
              <p className="text-base font-semibold">CRM + ERP</p>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <nav className="space-y-6 text-sm">
              {nav
                .filter((group) => isNavItemVisible(group, data.settings.role, data.rolePermissions || []))
                .map((item) => {
                  const Icon = item.icon ?? FolderKanban
                  if (item.children) {
                    const visibleChildren = item.children.filter((child) => isNavChildVisible(child, data.settings.role, data.rolePermissions || []))
                    return (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/45">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </div>
                        <div className="space-y-1">
                          {visibleChildren.map((child) => (
                            <Link
                              key={child.to}
                              to={child.to}
                              className={cn(
                                'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10',
                                activePath === child.to ? 'bg-white text-[#173f38] shadow-sm' : 'text-white/68'
                              )}
                            >
                              <span>{child.label}</span>
                              <ChevronRightMini className="h-4 w-4 opacity-60" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <Link
                      key={item.to}
                      to={item.to!}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10',
                        activePath === item.to ? 'bg-white text-[#173f38] shadow-sm' : 'text-white/82'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )
                })}
            </nav>
          </ScrollArea>
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-background/90 px-3 py-3 shadow-[0_14px_42px_-36px_rgba(15,23,42,0.45)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-5">
            <div className="lg:hidden">
              <MobileMenu nav={nav} />
            </div>
            <div className="relative flex-1 max-w-xl">
              <Input
                placeholder="Global arama (⌘/Ctrl + K)"
                onFocus={() => setSearchOpen(true)}
                className="h-10 bg-card/90 pl-10"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                      {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tema değiştir</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <NotificationMenu />
              <UserMenu />
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        clearTokens()
                        resetDemo()
                        setRole('Worker' as Role)
                        window.location.href = '/login'
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Çıkış Yap</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </header>

          <div className={cn('w-full p-4 md:p-6 xl:p-7', isWideWorkspace ? 'max-w-none' : 'max-w-[1680px]')}>
            <Outlet />
          </div>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {unackedAlerts[0] && (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="border-red-500 bg-destructive/10 backdrop-blur-md max-w-md animate-in fade-in zoom-in duration-200">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl text-red-600 font-bold animate-pulse">
                <Volume2 className="h-7 w-7 text-red-600" />
                {unackedAlerts[0].title || 'Yönetici Çağrısı'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-red-500/20 bg-card p-4 shadow-inner space-y-2">
                <p className="text-lg font-semibold text-foreground">{unackedAlerts[0].message}</p>
                
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-muted-foreground border-t border-dashed">
                  {unackedAlerts[0].department_name && (
                    <p><span className="font-medium text-foreground">Bölüm:</span> {unackedAlerts[0].department_name}</p>
                  )}
                  {unackedAlerts[0].station_code && (
                    <p><span className="font-medium text-foreground">İstasyon:</span> {unackedAlerts[0].station_code}</p>
                  )}
                  {unackedAlerts[0].work_order_number && (
                    <p className="col-span-2"><span className="font-medium text-foreground">İş Emri:</span> {unackedAlerts[0].work_order_number}</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                className="w-full h-12 text-base font-semibold bg-red-600 hover:bg-red-700 text-white"
                onClick={() => ackAlert(unackedAlerts[0].id)}
                disabled={ackingAlertId === unackedAlerts[0].id}
              >
                {ackingAlertId === unackedAlerts[0].id ? (
                  'Onaylanıyor...'
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" /> Okudum, Onayla
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ChevronRightMini(props: React.ComponentProps<'svg'>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className}><path d="M10 6l6 6-6 6" /></svg>
}

function MobileMenu({ nav }: { nav: NavItem[] }) {
  const [open, setOpen] = useState(false)
  const { data } = useAppStore()
  const routerState = useRouterState()
  const activePath = routerState.location.pathname
  const filtered = nav.filter((group) => isNavItemVisible(group, data.settings.role, data.rolePermissions || []))

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Menu className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 bg-card shadow-xl border border-border/70">
        {filtered.map((item) =>
          item.children ? (
            <div key={item.label} className="space-y-1">
              <p className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">{item.label}</p>
              {item.children.filter((child) => isNavChildVisible(child, data.settings.role, data.rolePermissions || [])).map((child) => (
                <DropdownMenuItem key={child.to} asChild>
                  <Link
                    to={child.to}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2 py-1 text-sm',
                      activePath === child.to ? 'bg-muted' : ''
                    )}
                  >
                    <span>{child.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          ) : (
            <DropdownMenuItem key={item.to} asChild>
              <Link to={item.to!} className="flex w-full items-center gap-2">
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </Link>
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationMenu() {
  const tasks = useAppStore((s) => s.data.tasks)
  const items = useMemo(() => {
    const now = Date.now()
    const soonMs = 24 * 60 * 60 * 1000
    const list: { id: string; title: string; time: string }[] = []
    tasks
      .filter((t) => t.status !== 'done')
      .forEach((t) => {
        if (!t.end && !t.due) return
        const dueDate = new Date(t.due || t.end || '').getTime()
        if (isNaN(dueDate)) return
        if (dueDate < now) {
          list.push({ id: `over-${t.id}`, title: `Geciken: ${t.title}`, time: 'gecikti' })
        } else if (dueDate - now <= soonMs) {
          list.push({ id: `soon-${t.id}`, title: `SLA yaklaşıyor: ${t.title}`, time: '24 saat içinde' })
        }
      })
    return list
  }, [tasks])
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 bg-card shadow-xl border border-border/70">
        <div className="px-3 py-2 text-sm font-semibold">Bildirimler</div>
        <Separator />
        {items.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">Henüz bildirim yok</div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="px-3 py-2 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const { data, resetDemo, setRole } = useAppStore()
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('current-user-id') : null
  const currentUser = data.users.find((u) => currentUserId && String(u.id) === String(currentUserId))
  const currentTeamName =
    data.teams.find((t) => t.memberIds?.includes(String(currentUserId)) || String(t.leaderId || '') === String(currentUserId))
      ?.name || '—'

  const userDisplayName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username || currentUser.email
    : data.settings.role

  const canViewSettings = ['Admin', 'Manager'].includes(data.settings.role)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full border hover:bg-muted">
          <Shield className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border border-border/70 p-1 shadow-lg">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1 py-1">
            <p className="text-sm font-semibold leading-none text-foreground">{userDisplayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {ROLE_LABEL_TR[data.settings.role] ?? data.settings.role}
            </p>
            {data.settings.role === 'Worker' && (
              <p className="text-xs leading-none text-muted-foreground/80 mt-0.5">
                Bölüm: {currentTeamName}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link to="/change-password" className="flex w-full items-center gap-2 cursor-pointer">
            <KeyRound className="h-4 w-4" />
            <span>Şifre Değiştir</span>
          </Link>
        </DropdownMenuItem>

        {canViewSettings && (
          <DropdownMenuItem asChild>
            <Link to="/settings" className="flex w-full items-center gap-2 cursor-pointer">
              <Settings className="h-4 w-4" />
              <span>Sistem Ayarları</span>
            </Link>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer flex items-center gap-2"
          onClick={() => {
            clearTokens()
            resetDemo()
            setRole('Worker' as Role)
            window.location.href = '/login'
          }}
        >
          <LogOut className="h-4 w-4" />
          <span>Çıkış Yap</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
