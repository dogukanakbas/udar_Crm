import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  Activity,
  CalendarClock,
  BarChart3,
  Bell,
  FolderKanban,
  Gauge,
  Home,
  KeyRound,
  Menu,
  Moon,
  Package,
  Search,
  Settings,
  Shield,
  SunMedium,
  LogOut,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
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

const nav: Array<{
  label: string
  to?: string
  icon: React.ComponentType<any>
  roles?: string[]
  perm?: string
  children?: Array<{ label: string; to: string; perm?: string; roles?: string[] }>
}> = [
  { label: 'Kontrol Paneli', to: '/', icon: Home, perm: 'settings.view' },
  { label: 'Görevlerim', to: '/', icon: Home, roles: ['Worker'] },
  { label: 'Geçmiş görevler', to: '/task-history', icon: CalendarClock, perm: 'tasks.view.own' },
  { label: 'Şifre değiştir', to: '/change-password', icon: KeyRound },
  {
    label: 'CRM',
    icon: Gauge,
    children: [
      { label: 'Fırsatlar', to: '/crm/opportunities', perm: 'opportunities.view' },
      { label: 'Cari Kartı', to: '/crm/companies', perm: 'partners.view' },
      { label: 'Kişiler', to: '/crm/contacts', perm: 'contacts.view' },
      { label: 'Teklif & Sözleşmeler', to: '/crm/quotes', perm: 'quotes.view.own' },
      { label: 'Satıcı Firmalar', to: '/crm/seller-companies', perm: 'templates.seller_companies.edit' },
      { label: 'Şablon Yönetimi', to: '/crm/quote-templates', perm: 'templates.view' },
    ],
  },
  {
    label: 'ERP',
    icon: Package,
    perm: 'erp.view',
    children: [
      { label: 'Satış Siparişleri', to: '/erp/sales-orders', perm: 'orders.view' },
      { label: 'Satınalma', to: '/erp/purchases', perm: 'orders.view' },
      { label: 'Stok', to: '/erp/inventory', perm: 'inventory.view' },
      { label: 'Faturalama', to: '/erp/invoicing', perm: 'invoices.view' },
      { label: 'Muhasebe', to: '/erp/accounting', perm: 'accounting.view' },
      { label: 'Lojistik Takip', to: '/logistics/tracking', perm: 'logistics.view' },
      { label: 'MDF Yönetimi', to: '/mdf', perm: 'inventory.view' },
      { label: 'MDF Giriş / Çıkış', to: '/mdf/history', perm: 'inventory.view' },
    ],
  },
  {
    label: 'Destek',
    icon: HeadsetIcon,
    children: [{ label: 'Destek talepleri', to: '/support/tickets', perm: 'tickets.view' }],
  },
  { label: 'Görevler', to: '/tasks', icon: ClipboardCheckIcon, perm: 'tasks.view' },
  { label: 'Çalışan Takibi', to: '/worker-tracking', icon: Activity, perm: 'worker_tracking.view' },
  { label: 'Takvim', to: '/calendar', icon: CalendarIconMini, perm: 'tasks.calendar.view' },
  { label: 'Raporlar', to: '/reports', icon: BarChart3, perm: 'reports.view' },
  { label: 'Ayarlar', to: '/settings', icon: Settings, perm: 'settings.view' },
]

const isNavItemVisible = (item: (typeof nav)[number], role: string, permissions: string[]) => {
  if (item.roles && !item.roles.includes(role)) return false
  if (item.children) {
    return item.children.some((child) => isNavChildVisible(child, role, permissions))
  }
  return hasPermission(role, permissions, item.perm)
}

const isNavChildVisible = (child: NonNullable<(typeof nav)[number]['children']>[number], role: string, permissions: string[]) => {
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

export function AppShell() {
  const { data, resetDemo, setRole } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const routerState = useRouterState()
  const loggedIn = !!getTokens()
  const isPublic = !loggedIn

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

  const activePath = routerState.location.pathname
  const isQuotesWorkspace = activePath.startsWith('/crm/quotes')
  const isSellerCompanyWorkspace = activePath.startsWith('/crm/seller-companies')
  const isQuoteTemplateWorkspace = activePath.startsWith('/crm/quote-templates')
  const isInventoryWorkspace = activePath.startsWith('/erp/inventory')
  const isWideWorkspace = isQuotesWorkspace || isSellerCompanyWorkspace || isQuoteTemplateWorkspace || isInventoryWorkspace

  useEffect(() => {
    const faviconUrl = resolveBrandingUrl(data.organization?.favicon_url, 'favicon')
    if (!faviconUrl) return
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (link) link.href = faviconUrl
  }, [data.organization?.favicon_url])

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
              <MobileMenu />
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
    </div>
  )
}

function ChevronRightMini(props: React.ComponentProps<'svg'>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className}><path d="M10 6l6 6-6 6" /></svg>
}

function MobileMenu() {
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
