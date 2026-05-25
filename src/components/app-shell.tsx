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
  Palette,
  Search,
  Settings,
  Shield,
  SunMedium,
  LogOut,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Role } from '@/types'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
  roles: string[]
  perm?: string
  children?: Array<{ label: string; to: string; perm?: string; roles?: string[] }>
}> = [
  { label: 'Kontrol Paneli', to: '/', icon: Home, roles: ['Admin', 'Manager', 'Sales', 'Finance', 'Support', 'Warehouse'] },
  { label: 'Görevlerim', to: '/', icon: Home, roles: ['Worker'] },
  { label: 'Geçmiş görevler', to: '/task-history', icon: CalendarClock, roles: ['Worker'], perm: 'tasks.view' },
  { label: 'Şifre değiştir', to: '/change-password', icon: KeyRound, roles: ['Admin', 'Manager', 'Sales', 'Finance', 'Support', 'Warehouse', 'Worker'] },
  {
    label: 'CRM',
    icon: Gauge,
    roles: ['Admin', 'Manager', 'Sales', 'Finance'],
    children: [
      { label: 'Fırsatlar', to: '/crm/opportunities', perm: 'opportunities.view' },
      { label: 'Cari Kartı', to: '/crm/companies', perm: 'partners.view' },
      { label: 'Kişiler', to: '/crm/contacts', perm: 'contacts.view' },
      { label: 'Teklifler', to: '/crm/quotes', perm: 'quotes.view' },
      { label: 'Satıcı Firmalar', to: '/crm/seller-companies', perm: 'pricing.manage', roles: ['Admin', 'Manager'] },
      { label: 'Şablon Yönetimi', to: '/crm/quote-templates', perm: 'pricing.manage', roles: ['Admin', 'Manager'] },
    ],
  },
  {
    label: 'ERP',
    icon: Package,
    roles: ['Admin', 'Manager', 'Finance', 'Warehouse', 'Sales'],
    children: [
      { label: 'Satış Siparişleri', to: '/erp/sales-orders', perm: 'orders.view' },
      { label: 'Satınalma', to: '/erp/purchases', perm: 'orders.view', roles: ['Admin', 'Manager', 'Finance', 'Warehouse'] },
      { label: 'Stok', to: '/erp/inventory', perm: 'inventory.view' },
      { label: 'Faturalama', to: '/erp/invoicing', perm: 'invoices.view' },
      { label: 'Muhasebe', to: '/erp/accounting', perm: 'invoices.view' },
      { label: 'Lojistik Takip', to: '/logistics/tracking', perm: 'logistics.view' },
      { label: 'MDF Yönetimi', to: '/mdf', perm: 'inventory.view' },
      { label: 'MDF Giriş / Çıkış', to: '/mdf/history', perm: 'inventory.view' },
    ],
  },
  {
    label: 'Destek',
    icon: HeadsetIcon,
    roles: ['Admin', 'Support', 'Manager'],
    children: [{ label: 'Destek talepleri', to: '/support/tickets', perm: 'tickets.view' }],
  },
  { label: 'Görevler', to: '/tasks', icon: ClipboardCheckIcon, roles: ['Admin', 'Manager', 'Sales', 'Finance', 'Support', 'Warehouse'], perm: 'tasks.view' },
  { label: 'Çalışan Takibi', to: '/worker-tracking', icon: Activity, roles: ['Admin', 'Manager'], perm: 'teams.view' },
  { label: 'Takvim', to: '/calendar', icon: CalendarIconMini, roles: ['Admin', 'Manager', 'Sales', 'Support', 'Warehouse'], perm: 'tasks.view' },
  { label: 'Raporlar', to: '/reports', icon: BarChart3, roles: ['Admin', 'Manager', 'Finance'], perm: 'audit.view' },
  { label: 'Ayarlar', to: '/settings', icon: Settings, roles: ['Admin', 'Manager'], perm: 'teams.edit' },
]

const isNavItemVisible = (item: (typeof nav)[number], role: string, permissions: string[]) => {
  if (!item.roles.includes(role)) return false
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
  const { data } = useAppStore()
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
          <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 border-r border-white/10 bg-[#102d29] p-4 text-white lg:block">
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#173f38] font-semibold shadow-[0_16px_38px_-22px_rgba(0,0,0,0.8)]">
              U
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Udar</p>
              <p className="text-base font-semibold">CRM + ERP</p>
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-116px)] pr-2">
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
  const { setTheme, theme } = useTheme()
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('current-user-id') : null
  const currentUser = data.users.find((u) => currentUserId && String(u.id) === String(currentUserId))
  const currentTeamName =
    data.teams.find((t) => t.memberIds?.includes(String(currentUserId)) || String(t.leaderId || '') === String(currentUserId))
      ?.name || '—'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full border">
          <Shield className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 space-y-2 bg-card shadow-xl border border-border/70">
        <div className="px-3 pt-2 space-y-1">
          <p className="text-sm font-semibold">Oturum</p>
          <p className="text-xs text-muted-foreground">
            Rol: {ROLE_LABEL_TR[data.settings.role] ?? data.settings.role}
          </p>
          {data.settings.role === 'Worker' && (
            <>
              <p className="text-xs text-muted-foreground">
                İsim Soyisim: {currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username : '—'}
              </p>
              <p className="text-xs text-muted-foreground">Bölüm: {currentTeamName}</p>
            </>
          )}
        </div>
        <Separator />
        <div className="px-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Tema</span>
            <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Palette className="mr-2 h-4 w-4" />
              {theme === 'dark' ? 'Koyu' : 'Açık'}
            </Button>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Dil tercihi için Ayarlar sayfasını kullanın.</span>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm"
            onClick={() => {
              clearTokens()
              resetDemo()
              setRole('Worker' as Role)
              window.location.href = '/login'
            }}
          >
            <LogOut className="h-4 w-4" />
            Çıkış yap
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
