import { RouterProvider, RootRoute, Route, createRouter, redirect } from '@tanstack/react-router'

import { AppShell } from '@/components/app-shell'
import { DashboardPage } from '@/pages/dashboard'
import { CompaniesPage, ContactsPage, LeadDetailPage, LeadsPage, OpportunitiesPage } from '@/pages/crm'
import { AccountingPage, InventoryPage, InvoicingPage, PurchasesPage, SalesOrdersPage } from '@/pages/erp'
import { LogisticsTrackingPage } from '@/pages/logistics'
import { ReportsPage } from '@/pages/reports'
import { SettingsPage } from '@/pages/settings'
import { TicketsPage } from '@/pages/support'
import { TasksPage, TaskDetailPage } from '@/pages/tasks'
import { QuotesPage, QuoteDetailPage } from '@/pages/quotes'
import { CalendarPage } from '@/pages/calendar'
import { LoginPage } from '@/pages/login'
import { ActivatePage } from '@/pages/activate'
import AccessLogsPage from '@/pages/access-logs'
import { getTokens } from '@/lib/auth'

const rootRoute = new RootRoute({
  component: AppShell,
  beforeLoad: ({ location }) => {
    if (location.pathname === '/login' || location.pathname === '/activate') return
    const tokens = getTokens()
    if (!tokens) {
      throw redirect({ to: '/login' })
    }
  },
})

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const leadsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/leads',
  component: LeadsPage,
})

const leadDetailRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/leads/$leadId',
  component: LeadDetailPage,
})

const opportunitiesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/opportunities',
  component: OpportunitiesPage,
})

const companiesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/companies',
  component: CompaniesPage,
})

const contactsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/contacts',
  component: ContactsPage,
})

const quotesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/quotes',
  component: QuotesPage,
})

const quoteNewRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/quotes/new',
  component: QuotesPage,
})

const quoteDetailRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/crm/quotes/$quoteId',
  component: QuoteDetailPage,
})

const salesOrdersRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/sales-orders',
  component: SalesOrdersPage,
})

const purchasesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/purchases',
  component: PurchasesPage,
})

const inventoryRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/inventory',
  component: InventoryPage,
})

const invoicingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/invoicing',
  component: InvoicingPage,
})

const accountingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/erp/accounting',
  component: AccountingPage,
})

const ticketsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/support/tickets',
  component: TicketsPage,
})

const logisticsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/logistics/tracking',
  component: LogisticsTrackingPage,
})

const tasksRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  component: TasksPage,
})

const taskDetailRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/tasks/$taskId',
  component: TaskDetailPage,
})

const calendarRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarPage,
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
  component: ReportsPage,
})

const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

const accessLogsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/access-logs',
  component: AccessLogsPage,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  loginRoute,
  activateRoute,
  leadsRoute,
  leadDetailRoute,
  opportunitiesRoute,
  companiesRoute,
  contactsRoute,
  quotesRoute,
  quoteNewRoute,
  quoteDetailRoute,
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
  reportsRoute,
  settingsRoute,
  accessLogsRoute,
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

