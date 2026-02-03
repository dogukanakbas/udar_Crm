import { useEffect, useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  Activity,
  BarChart3,
  Bell,
  FolderKanban,
  Gauge,
  Home,
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
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/components/theme-provider'
import { GlobalSearch } from '@/components/global-search'
import { useAppStore } from '@/state/use-app-store'
import { cn } from '@/lib/utils'
import { getTokens, clearTokens } from '@/lib/auth'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumb?: React.ReactNode
}

export const PageHeader = ({ title, description, actions, breadcrumb }: PageHeaderProps) => (
  <div className="mb-6 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
    <div>
      {breadcrumb}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
    {actions}
  </div>
)

const nav = [
  { label: 'Kontrol Paneli', to: '/', icon: Home, roles: ['Admin', 'Manager', 'Sales', 'Finance', 'Support', 'Warehouse'] },
  {
    label: 'CRM',
    icon: Gauge,
    roles: ['Admin', 'Manager', 'Sales'],
    children: [
      { label: 'Leadler', to: '/crm/leads' },
      { label: 'Fırsatlar', to: '/crm/opportunities' },
      { label: 'Şirketler', to: '/crm/companies' },
      { label: 'Kişiler', to: '/crm/contacts' },
      { label: 'Teklifler', to: '/crm/quotes' },
    ],
  },
  {
    label: 'ERP',
    icon: Package,
    roles: ['Admin', 'Manager', 'Finance', 'Warehouse'],
    children: [
      { label: 'Satış Siparişleri', to: '/erp/sales-orders' },
      { label: 'Satınalma', to: '/erp/purchases' },
      { label: 'Stok', to: '/erp/inventory' },
      { label: 'Faturalama', to: '/erp/invoicing' },
      { label: 'Muhasebe', to: '/erp/accounting' },
      { label: 'Lojistik Takip', to: '/logistics/tracking' },
    ],
  },
  {
    label: 'Destek',
    icon: HeadsetIcon,
    roles: ['Admin', 'Support', 'Manager'],
    children: [{ label: 'Ticketlar', to: '/support/tickets' }],
  },
  { label: 'Görevler', to: '/tasks', icon: ClipboardCheckIcon, roles: ['Admin', 'Manager', 'Sales', 'Finance', 'Support', 'Warehouse', 'Worker'] },
  { label: 'Takvim', to: '/calendar', icon: CalendarIconMini, roles: ['Admin', 'Manager', 'Sales', 'Support'] },
  { label: 'Raporlar', to: '/reports', icon: BarChart3, roles: ['Admin', 'Manager', 'Finance'] },
  { label: 'Ayarlar', to: '/settings', icon: Settings, roles: ['Admin', 'Manager'] },
]

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

  if (isPublic) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-[520px] p-6">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen bg-gradient-to-b from-background to-muted/30', data.settings.demoWatermark && "relative before:content-['Udar_CRM_Demo'] before:fixed before:right-4 before:bottom-4 before:rotate-[-20deg] before:text-6xl before:font-bold before:text-primary/10 before:pointer-events-none")}>
      <div className="mx-auto flex max-w-[1400px]">
        {loggedIn && (
          <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-card/60 p-4 lg:block">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
              U
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Udar CRM + ERP</p>
              <p className="text-base font-semibold">Demo Çalışma Alanı</p>
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-120px)] pr-2">
            <nav className="space-y-6 text-sm">
              {nav
                .filter((group) => group.roles.includes(data.settings.role))
                .map((item) => {
                  const Icon = item.icon ?? FolderKanban
                  if (item.children) {
                    return (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </div>
                        <div className="space-y-1">
                          {item.children.map((child) => (
                            <Link
                              key={child.to}
                              to={child.to}
                              className={cn(
                                'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
                                activePath === child.to ? 'bg-muted text-foreground' : 'text-muted-foreground'
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
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted',
                        activePath === item.to ? 'bg-primary/10 text-primary' : 'text-foreground'
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

        <main className="flex-1">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/80 bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="lg:hidden">
              <MobileMenu />
            </div>
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Global arama (⌘/Ctrl + K)"
                onFocus={() => setSearchOpen(true)}
                className="pl-10"
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

          <div className="p-4 md:p-6">
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
  const filtered = nav.filter((group) => group.roles.includes(data.settings.role))

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Menu className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {filtered.map((item) =>
          item.children ? (
            <div key={item.label} className="space-y-1">
              <p className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">{item.label}</p>
              {item.children.map((child) => (
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
  const items: { id: number; title: string; time: string }[] = []
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-3 py-2 text-sm font-semibold">Bildirimler</div>
        <Separator />
        {items.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">Henüz bildirim yok</div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="px-3 py-2 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.time} önce</p>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const { data, toggleWatermark, resetDemo, setRole } = useAppStore()
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full border">
          <Shield className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 space-y-2">
        <div className="px-3 pt-2 space-y-1">
          <p className="text-sm font-semibold">Oturum</p>
          <p className="text-xs text-muted-foreground">Rol: {data.settings.role}</p>
        </div>
        <Separator />
        <div className="px-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Demo filigranı</span>
            <Switch checked={data.settings.demoWatermark} onCheckedChange={toggleWatermark} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Tema</span>
            <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Palette className="mr-2 h-4 w-4" />
              {theme === 'dark' ? 'Koyu' : 'Açık'}
            </Button>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>TR / EN dilini Ayarlar sayfasından değiştir.</span>
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

