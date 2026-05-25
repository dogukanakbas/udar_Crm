import { RouterProvider, RootRoute, Route, createRouter, redirect } from '@tanstack/react-router'
import type { ComponentType } from 'react'

import { AppShell } from '@/components/app-shell'
import { DashboardPage } from '@/pages/dashboard'
import { CompaniesPage, ContactsPage, OpportunitiesPage } from '@/pages/crm'
import { AccountingPage, InventoryPage, InvoicingPage, PurchasesPage, SalesOrdersPage } from '@/pages/erp'
import { LogisticsTrackingPage } from '@/pages/logistics'
import { ReportsPage } from '@/pages/reports'
import { SettingsPage } from '@/pages/settings'
import { TicketsPage } from '@/pages/support'
import { TasksPage, TaskDetailPage } from '@/pages/tasks'
import { QuotesPage, QuoteDetailPage } from '@/pages/quotes'
import { QuoteTemplatesPage } from '@/pages/quote-templates'
import { SellerCompaniesPage } from '@/pages/seller-companies'
import { CalendarPage } from '@/pages/calendar'
import { WorkerTrackingPage } from '@/pages/worker-tracking'
import { WorkerDetailPage } from '@/pages/worker-detail'
import { ChangePasswordPage } from '@/pages/change-password'
import { TaskHistoryPage } from '@/pages/task-history'
import { LoginPage } from '@/pages/login'
import { ActivatePage } from '@/pages/activate'
import AccessLogsPage from '@/pages/access-logs'
import { MdfHistoryPage } from '@/pages/mdf-history'
import { MdfManagementPage } from '@/pages/mdf-management'
import { getTokens } from '@/lib/auth'
import { useAppStore } from '@/state/use-app-store'
import { hasPermission } from '@/lib/permissions'

const rootRoute = new RootRoute({
  component: AppShell,
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login' || location.pathname === '/activate') return
    const tokens = getTokens()
    if (!tokens) {
      throw redirect({ to: '/login' })
    }
    
    // Route geçişini API bekletmesin; veri arka planda tazelensin.
    try {
      const store = useAppStore.getState()
      void store.hydrateFromApi({ force: false })
    } catch (err) {
      console.error('Route hydration failed', err)
      // Hata olsa bile route'a izin ver (offline durumlar için)
    }
  },
})

function AccessDeniedPage() {
  return (
    <div className="rounded-lg border border-border/70 bg-card/80 p-6">
      <h1 className="text-xl font-semibold">Yetkiniz yok</h1>
      <p className="mt-2 text-sm text-muted-foreground">Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz.</p>
    </div>
  )
}

function secured(Component: ComponentType, perm?: string) {
  return function SecuredRouteComponent() {
    const role = useAppStore((state) => state.data.settings.role)
    const permissions = useAppStore((state) => state.data.rolePermissions || [])
    if (!hasPermission(role, permissions, perm)) return <AccessDeniedPage />
    return <Component />
  }
}

function adminOnly(Component: ComponentType) {
  return function AdminOnlyRouteComponent() {
    const role = useAppStore((state) => state.data.settings.role)
    if (role !== 'Admin') return <AccessDeniedPage />
    return <Component />
  }
}

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const opportunitiesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/opportunities',
  component: secured(OpportunitiesPage, 'opportunities.view'),
})

const companiesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/companies',
  component: secured(CompaniesPage, 'partners.view'),
})

const contactsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/contacts',
  component: adminOnly(ContactsPage),
})

const quotesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/quotes',
  component: secured(QuotesPage, 'quotes.view'),
})

const quoteNewRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/quotes/new',
  component: secured(QuotesPage, 'quotes.edit'),
})

const quoteDetailRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/quotes/$quoteId',
  component: secured(QuoteDetailPage, 'quotes.view'),
})

const quoteTemplatesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/quote-templates',
  component: secured(QuoteTemplatesPage, 'pricing.manage'),
})

const sellerCompaniesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/seller-companies',
  component: secured(SellerCompaniesPage, 'pricing.manage'),
})

const salesOrdersRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/sales-orders',
  component: adminOnly(SalesOrdersPage),
})

const purchasesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/purchases',
  component: secured(PurchasesPage, 'orders.view'),
})

const inventoryRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/inventory',
  component: secured(InventoryPage, 'inventory.view'),
})

const invoicingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/invoicing',
  component: secured(InvoicingPage, 'invoices.view'),
})

const accountingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/accounting',
  component: secured(AccountingPage, 'invoices.view'),
})

const ticketsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/support/tickets',
  component: secured(TicketsPage, 'tickets.view'),
})

const logisticsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/logistics/tracking',
  component: secured(LogisticsTrackingPage, 'logistics.view'),
})

const tasksRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  component: adminOnly(TasksPage),
})

const taskDetailRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/tasks/$taskId',
  component: secured(TaskDetailPage, 'tasks.view'),
})

const calendarRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: adminOnly(CalendarPage),
})

const workerTrackingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/worker-tracking',
  component: secured(WorkerTrackingPage, 'teams.view'),
})

const workerDetailRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/worker-tracking/$workerId',
  component: secured(WorkerDetailPage, 'teams.view'),
})

const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const activateRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/activate',
  component: ActivatePage,
})

const reportsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: secured(ReportsPage, 'audit.view'),
})

const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: secured(SettingsPage, 'teams.edit'),
})

const changePasswordRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/change-password',
  component: ChangePasswordPage,
})

const taskHistoryRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/task-history',
  component: secured(TaskHistoryPage, 'tasks.view'),
})

const accessLogsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/access-logs',
  component: secured(AccessLogsPage, 'audit.view'),
})

const mdfManagementRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/mdf',
  component: secured(MdfManagementPage, 'inventory.view'),
})

const mdfHistoryRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/mdf/history',
  component: secured(MdfHistoryPage, 'inventory.view'),
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  loginRoute,
  activateRoute,
  opportunitiesRoute,
  companiesRoute,
  contactsRoute,
  quotesRoute,
  quoteNewRoute,
  quoteDetailRoute,
  quoteTemplatesRoute,
  sellerCompaniesRoute,
  salesOrdersRoute,
  purchasesRoute,
  inventoryRoute,
  invoicingRoute,
  accountingRoute,
  ticketsRoute,
  logisticsRoute,
  tasksRoute,
  taskDetailRoute,
  calendarRoute,
  workerTrackingRoute,
  workerDetailRoute,
  reportsRoute,
  settingsRoute,
  changePasswordRoute,
  taskHistoryRoute,
  accessLogsRoute,
  mdfManagementRoute,
  mdfHistoryRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />
}
